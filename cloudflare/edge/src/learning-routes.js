import {uid, fail, staff, assessment, student, consent, audit, packFor, responsesFor, assessmentView, readBody, validate} from './kernel.js';
import {diagnose, prioritize, recommend, selectVerification, updateSupport} from './algorithms.js';

export async function runRecord(ctx, id, lock = false) {
  const run = (await ctx.q('SELECT * FROM diagnostic_runs WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [id]))[0];
  if (!run) fail(404, 'Diagnostic not found');
  await assessment(ctx, run.assessment_id, ctx.user);
  return run;
}
export async function runView(ctx, run) {
  const evidence = (await ctx.q('SELECT * FROM evidence WHERE run_id=$1', [run.id])).map(e => ({id: e.id, ...e.payload}));
  const hypotheses = (await ctx.q('SELECT * FROM hypotheses WHERE run_id=$1', [run.id])).map(h => ({id: h.id, ...h.payload}));
  const verifications = await ctx.q('SELECT * FROM verifications WHERE run_id=$1', [run.id]);
  const updates = verifications.flatMap(v => v.result?.updates || []);
  const record = await assessment(ctx, run.assessment_id, ctx.user), pack = await packFor(ctx, record);
  for (const h of hypotheses) {
    const matching = updates.filter(u => u.kind === h.kind && u.concept_id === h.concept_id);
    h.verification_history = matching; h.verification_status = matching.at(-1)?.verification_status || 'not_tested';
    h.initial_support = h.support;
    if (matching.length) { h.support = matching.at(-1).updated_support; h.uncertainty = matching.at(-1).uncertainty; }
    h.priority = prioritize(pack, evidence.find(e => e.concept_id === h.concept_id), h.verification_status === 'supported');
  }
  return {id: run.id, assessment_id: run.assessment_id, engine_version: run.engine_version, created_at: run.created_at,
    evidence, hypotheses, verifications: verifications.map(v => ({id: v.id, assessment_id: v.assessment_id, selection: v.selection, result: v.result})),
    interpretation: 'Diagnostic inferences from unvalidated sample content. No clinical or causal labels.'};
}

export async function learningRoutes(ctx) {
  const {path, request, user} = ctx, method = request.method;
  let match;
  if ((match = /^\/api\/assessments\/([^/]+)\/diagnostics$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/assessments/:id/diagnostics';
    const record = await assessment(ctx, match[1], user, true); await consent(ctx, record.student_id);
    if (record.status !== 'completed' || record.stage !== 'pre') fail(409, 'Complete a baseline assessment first');
    const existing = (await ctx.q('SELECT * FROM diagnostic_runs WHERE assessment_id=$1', [record.id]))[0];
    if (existing) return {status: 201, data: await runView(ctx, existing)};
    const [evidence, hypotheses] = diagnose(await packFor(ctx, record), await responsesFor(ctx, record.id));
    const run = (await ctx.q('INSERT INTO diagnostic_runs(id,assessment_id,engine_version,created_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP) RETURNING *', [uid(), record.id, ctx.content.engineVersion]))[0];
    for (const payload of evidence) await ctx.q('INSERT INTO evidence(id,run_id,payload) VALUES($1,$2,$3::json)', [uid(), run.id, JSON.stringify(payload)]);
    for (const payload of hypotheses) await ctx.q('INSERT INTO hypotheses(id,run_id,payload) VALUES($1,$2,$3::json)', [uid(), run.id, JSON.stringify(payload)]);
    await audit(ctx, user, 'diagnostic.created'); return {status: 201, data: await runView(ctx, run)};
  }
  if ((match = /^\/api\/diagnostics\/([^/]+)$/.exec(path)) && method === 'GET') {
    ctx.route = '/api/diagnostics/:id'; return {status: 200, data: await runView(ctx, await runRecord(ctx, match[1]))};
  }
  if ((match = /^\/api\/diagnostics\/([^/]+)\/recommendations$/.exec(path)) && method === 'GET') {
    ctx.route = '/api/diagnostics/:id/recommendations'; staff(user);
    const run = await runRecord(ctx, match[1]), record = await assessment(ctx, run.assessment_id, user);
    const view = await runView(ctx, run), pack = await packFor(ctx, record);
    const concepts = [...new Set(view.hypotheses.filter(h => ['knowledge_gap', 'reasoning_gap', 'misconception'].includes(h.kind) && h.verification_status !== 'contradicted').map(h => h.concept_id))].sort();
    return {status: 200, data: concepts.map(id => recommend(pack, id))};
  }
  if ((match = /^\/api\/assessments\/([^/]+)\/verification$/.exec(path)) && method === 'GET') {
    ctx.route = '/api/assessments/:id/verification';
    const record = await assessment(ctx, match[1], user);
    const v = (await ctx.q('SELECT * FROM verifications WHERE assessment_id=$1', [record.id]))[0];
    if (!v) fail(404, 'Assessment is not a verification');
    const run = await runRecord(ctx, v.run_id);
    return {status: 200, data: {verification_id: v.id, run_id: v.run_id, baseline_assessment_id: run.assessment_id}};
  }
  if ((match = /^\/api\/diagnostics\/([^/]+)\/verification$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/diagnostics/:id/verification';
    const run = await runRecord(ctx, match[1], true), baseline = await assessment(ctx, run.assessment_id, user);
    await consent(ctx, baseline.student_id);
    const history = await ctx.q('SELECT * FROM verifications WHERE run_id=$1', [run.id]);
    for (const v of history) if (v.result === null) return {status: 201, data: {id: v.id,
      assessment: await assessmentView(ctx, await assessment(ctx, v.assessment_id, user)), selection: v.selection}};
    const pack = await packFor(ctx, baseline), used = new Set();
    for (const v of history) for (const id of (await assessment(ctx, v.assessment_id, user)).item_ids) used.add(id);
    const hypotheses = (await ctx.q('SELECT payload FROM hypotheses WHERE run_id=$1', [run.id])).map(h => h.payload);
    for (const v of history) for (const u of v.result?.updates || []) for (const h of hypotheses) {
      if (h.kind === u.kind && h.concept_id === u.concept_id) { h.support = u.updated_support; h.uncertainty = u.uncertainty; }
    }
    const selected = selectVerification(pack, hypotheses, used);
    if (!selected) fail(409, 'No unused curated verification items distinguish the remaining hypotheses');
    const record = (await ctx.q("INSERT INTO assessments(id,student_id,subject_version,stage,status,item_ids,intervention_id,created_at) VALUES($1,$2,$3,'verification','open',$4::json,NULL,CURRENT_TIMESTAMP) RETURNING *", [uid(), baseline.student_id, baseline.subject_version, JSON.stringify([selected.item.id])]))[0];
    const v = (await ctx.q('INSERT INTO verifications(id,run_id,assessment_id,selection,result) VALUES($1,$2,$3,$4::json,NULL) RETURNING *', [uid(), run.id, record.id, JSON.stringify(selected.reason)]))[0];
    await audit(ctx, user, 'verification.assigned');
    return {status: 201, data: {id: v.id, assessment: await assessmentView(ctx, record), selection: selected.reason}};
  }
  if ((match = /^\/api\/verifications\/([^/]+)\/evaluate$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/verifications/:id/evaluate';
    const v = (await ctx.q('SELECT * FROM verifications WHERE id=$1 FOR UPDATE', [match[1]]))[0];
    if (!v) fail(404, 'Verification not found');
    const record = await assessment(ctx, v.assessment_id, user); await consent(ctx, record.student_id);
    if (record.status !== 'completed') fail(409, 'Complete the verification assessment first');
    if (v.result !== null) return {status: 200, data: v.result};
    const hypotheses = (await ctx.q('SELECT payload FROM hypotheses WHERE run_id=$1', [v.run_id])).map(h => h.payload);
    const prior = await ctx.q('SELECT result FROM verifications WHERE run_id=$1', [v.run_id]);
    for (const previous of prior) for (const u of previous.result?.updates || []) for (const h of hypotheses) {
      if (h.kind === u.kind && h.concept_id === u.concept_id) { h.support = u.updated_support; h.uncertainty = u.uncertainty; }
    }
    const pack = await packFor(ctx, record), response = (await responsesFor(ctx, record.id))[0];
    const result = {updates: updateSupport(hypotheses, pack.items.find(i => i.id === response.item_id), response), response_id: response.id,
      interpretation: 'Verification support is provisional, not experimental proof.'};
    await ctx.q('UPDATE verifications SET result=$1::json WHERE id=$2', [JSON.stringify(result), v.id]);
    await audit(ctx, user, 'verification.evaluated'); return {status: 200, data: result};
  }
  if (path === '/api/interventions' && method === 'POST') {
    ctx.route = path; staff(user);
    const input = validate(ctx.content.schemas.InterventionInput, await readBody(request));
    await student(ctx, input.student_id, user); await consent(ctx, input.student_id);
    const baseline = await assessment(ctx, input.baseline_assessment_id, user), pack = await packFor(ctx, baseline);
    if (baseline.student_id !== input.student_id || baseline.stage !== 'pre' || baseline.status !== 'completed' || pack.id !== input.subject_id) fail(422, 'Baseline must be a completed pre-assessment for this learner and subject');
    if (!pack.concepts.some(c => c.id === input.concept_id)) fail(422, 'Concept is not in this subject');
    const id = uid();
    await ctx.q("INSERT INTO interventions(id,student_id,teacher_id,subject_version,baseline_assessment_id,concept_id,activity,expected_outcome,review_note,status,created_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'assigned',CURRENT_TIMESTAMP,NULL)",
      [id, input.student_id, user.id, baseline.subject_version, baseline.id, input.concept_id, input.activity, input.expected_outcome, input.review_note]);
    await audit(ctx, user, 'intervention.teacher_approved'); return {status: 201, data: {id, status: 'assigned'}};
  }
  if ((match = /^\/api\/interventions\/([^/]+)$/.exec(path)) && method === 'PATCH') {
    ctx.route = '/api/interventions/:id'; staff(user);
    const input = validate(ctx.content.schemas.InterventionUpdate, await readBody(request));
    const record = (await ctx.q('SELECT * FROM interventions WHERE id=$1 FOR UPDATE', [match[1]]))[0];
    if (!record) fail(404, 'Intervention not found');
    await student(ctx, record.student_id, user);
    if (record.status !== 'assigned') fail(409, 'Completed or cancelled history is immutable; create a new intervention');
    await ctx.q("UPDATE interventions SET status=$1,review_note=$2,completed_at=CASE WHEN $1='completed' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=$3", [input.status, input.review_note, record.id]);
    await audit(ctx, user, 'intervention.' + input.status); return {status: 200, data: {id: record.id, status: input.status}};
  }
  return null;
}

