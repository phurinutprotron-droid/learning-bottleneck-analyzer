import {HTTPError, uid, fail, PASSWORD_PREFIX, DUMMY_HASH, BCRYPT, prehash, digest, validate, readBody,
  staff, currentUser, student, assessment, consent, audit, identity, issueSession, packFor, responsesFor,
  assessmentView} from './kernel.js';
import {grade, traverse} from './algorithms.js';

const ok = (data, status = 200) => ({data, status});
async function body(ctx, name) { return validate(ctx.content.schemas[name], await readBody(ctx.request)); }

export async function coreRoutes(ctx) {
  const {path, request, content} = ctx, method = request.method;
  let match;
  if (path === '/health' && method === 'GET') {
    ctx.route = '/health';
    await ctx.q('SELECT 1');
    return ok({status: 'ok', version: '0.1.0'});
  }
  if (path === '/api/auth/register' && method === 'POST') {
    ctx.route = '/api/auth/register';
    const input = await body(ctx, 'Registration');
    if ((await ctx.q('SELECT id FROM users WHERE handle=$1', [input.handle])).length) fail(409, 'Handle unavailable');
    const prepared = await prehash(input.password, ctx.env.PASSWORD_PEPPER);
    const hashed = (await ctx.q("SELECT crypt($1,gen_salt('bf',12)) AS hash", [prepared]))[0].hash;
    if (!BCRYPT.test(hashed)) fail(503, 'Password hashing unavailable');
    const user = {id: uid(), handle: input.handle, role: 'student', is_demo: false};
    await ctx.q('INSERT INTO users(id,handle,password_hash,role,is_demo,created_at) VALUES($1,$2,$3,$4,false,CURRENT_TIMESTAMP)',
      [user.id, user.handle, PASSWORD_PREFIX + hashed, user.role]);
    await ctx.q('INSERT INTO students(id,user_id,anonymous_id,grade) VALUES($1,$2,$3,$4)',
      [uid(), user.id, 'L-' + uid().replaceAll('-', '').slice(0, 10), input.grade]);
    await audit(ctx, user, 'account.registered');
    return ok(await issueSession(ctx, user), 201);
  }
  if ((match = /^\/api\/auth\/login(?:\/(student|teacher|researcher))?$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/auth/login/:portal';
    const input = await body(ctx, 'Credentials');
    const user = (await ctx.q('SELECT * FROM users WHERE handle=$1', [input.handle]))[0];
    const stored = user?.password_hash?.startsWith(PASSWORD_PREFIX) ? user.password_hash.slice(PASSWORD_PREFIX.length) : DUMMY_HASH;
    const safeHash = BCRYPT.test(stored) ? stored : DUMMY_HASH;
    const prepared = await prehash(input.password, ctx.env.PASSWORD_PEPPER);
    const valid = (await ctx.q('SELECT crypt($1,$2)=$2 AS valid', [prepared, safeHash]))[0].valid;
    if (!user || !user.password_hash.startsWith(PASSWORD_PREFIX) || !valid || user.is_demo) fail(401, 'Invalid handle or password');
    if (match[1] && user.role !== match[1]) fail(403, `Use the ${user.role} sign-in for this account`);
    await audit(ctx, user, 'session.created');
    return ok(await issueSession(ctx, user));
  }
  if (!path.startsWith('/api/')) return null;
  const user = ctx.user ||= await currentUser(ctx);
  if (path === '/api/auth/me' && method === 'GET') { ctx.route = path; return ok(await identity(ctx, user)); }
  if (path === '/api/auth/logout' && method === 'POST') {
    ctx.route = path;
    await ctx.q('DELETE FROM sessions WHERE token_hash=$1', [await digest(ctx.sessionToken)]);
    await audit(ctx, user, 'session.revoked');
    return ok(null, 204);
  }
  if (path === '/api/subjects' && method === 'GET') {
    ctx.route = path;
    return ok(Object.values(content.packs).map(({items, ...pack}) => ({...pack, baseline_item_count: items.filter(i => i.stage === 'pre').length})));
  }
  if ((match = /^\/api\/subjects\/([^/]+)\/graph$/.exec(path)) && method === 'GET') {
    ctx.route = '/api/subjects/:id/graph';
    const pack = content.packs[match[1]], concept = ctx.url.searchParams.get('concept_id');
    if (!pack) fail(404, 'Subject not found');
    if (concept && !pack.concepts.some(c => c.id === concept)) fail(404, 'Concept not found');
    return ok({nodes: pack.concepts, edges: pack.relationships, validation: content.graphValidation[pack.id],
      prerequisites: concept ? traverse(pack, concept, true) : []});
  }
  if (path === '/api/graph' && method === 'GET') {
    ctx.route = path;
    return ok({nodes: Object.values(content.packs).flatMap(p => p.concepts),
      edges: [...Object.values(content.packs).flatMap(p => p.relationships), ...content.crossRelationships], validation: content.crossValidation});
  }
  if (path === '/api/students' && method === 'GET') {
    ctx.route = path; staff(user);
    return ok(await ctx.q("SELECT s.id,s.anonymous_id,s.grade,COUNT(a.id)::int AS assessments_completed FROM students s LEFT JOIN assessments a ON a.student_id=s.id AND a.status='completed' GROUP BY s.id ORDER BY s.anonymous_id"));
  }
  if ((match = /^\/api\/students\/([^/]+)$/.exec(path))) {
    ctx.route = '/api/students/:id';
    const record = await student(ctx, match[1], user);
    if (method === 'GET') {
      const latest = (await ctx.q('SELECT * FROM consents WHERE student_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [record.id]))[0];
      const assessments = await ctx.q('SELECT * FROM assessments WHERE student_id=$1 ORDER BY created_at DESC', [record.id]);
      const interventions = await ctx.q('SELECT * FROM interventions WHERE student_id=$1 ORDER BY created_at DESC', [record.id]);
      const outcomes = await ctx.q('SELECT l.payload FROM learning_results l JOIN assessments a ON a.id=l.assessment_id WHERE a.student_id=$1', [record.id]);
      return ok({id: record.id, anonymous_id: record.anonymous_id, grade: record.grade,
        consent: !!(latest?.granted && latest.version === 'pilot-v1'), consent_version: 'pilot-v1',
        assessments: await Promise.all(assessments.map(a => assessmentView(ctx, a))),
        interventions: interventions.map(i => ({id: i.id, concept_id: i.concept_id, activity: i.activity,
          expected_outcome: i.expected_outcome, status: i.status, review_note: i.review_note, subject_id: i.subject_version.split(':')[0]})),
        outcomes: outcomes.map(o => o.payload)});
    }
    if (method === 'DELETE') {
      await ctx.q('UPDATE assessments SET intervention_id=NULL WHERE student_id=$1', [record.id]);
      await ctx.q('DELETE FROM users WHERE id=$1', [record.user_id]);
      if (user.id !== record.user_id) await audit(ctx, user, 'student.data_deleted');
      return ok(null, 204);
    }
  }
  if ((match = /^\/api\/students\/([^/]+)\/consent$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/students/:id/consent';
    const input = await body(ctx, 'ConsentInput');
    await student(ctx, match[1], user);
    await ctx.q('INSERT INTO consents(id,student_id,version,granted,created_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)', [uid(), match[1], 'pilot-v1', input.granted]);
    await audit(ctx, user, input.granted ? 'consent.granted' : 'consent.withdrawn');
    return ok({granted: input.granted, version: 'pilot-v1', notice: 'Pilot assent record only. School/guardian authorization and reviewed notices are required before use with minors.'});
  }
  if ((match = /^\/api\/students\/([^/]+)\/assessments$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/students/:id/assessments';
    const input = await body(ctx, 'AssessmentInput'), sid = match[1];
    await student(ctx, sid, user); await consent(ctx, sid);
    await ctx.q('SELECT id FROM students WHERE id=$1 FOR UPDATE', [sid]);
    const pack = content.packs[input.subject_id];
    if (!pack) fail(404, 'Subject not found');
    const version = pack.id + ':' + pack.version;
    let items;
    if (input.stage !== 'pre') {
      const intervention = (await ctx.q('SELECT * FROM interventions WHERE id=$1', [input.intervention_id]))[0];
      if (!intervention || intervention.student_id !== sid || intervention.subject_version !== version || intervention.status !== 'completed') fail(409, 'A completed intervention in this subject is required for follow-up');
      if ((await ctx.q('SELECT id FROM assessments WHERE intervention_id=$1 AND stage=$2', [intervention.id, input.stage])).length) fail(409, 'A follow-up for this stage already exists; resume it instead');
      if (input.stage === 'retention' && Date.now() - new Date(intervention.completed_at).getTime() < 7 * 86400000) fail(409, 'Retention follow-up requires at least seven days after intervention completion');
      items = pack.items.filter(i => i.stage === input.stage && i.concept_id === intervention.concept_id).map(i => i.id);
    } else {
      if (input.intervention_id) fail(422, 'Baseline assessments cannot be linked as follow-ups');
      if ((await ctx.q("SELECT id FROM assessments WHERE student_id=$1 AND subject_version=$2 AND stage='pre' AND status='open'", [sid, version])).length) fail(409, 'An open baseline exists; resume it from your profile');
      items = pack.items.filter(i => i.stage === 'pre').map(i => i.id);
    }
    await ctx.q('INSERT INTO subject_versions(id,snapshot) VALUES($1,$2::json) ON CONFLICT(id) DO NOTHING', [version, JSON.stringify(pack)]);
    const persisted = (await ctx.q('SELECT snapshot FROM subject_versions WHERE id=$1', [version]))[0].snapshot;
    // Compare recursively below instead of trusting a version with different approved content.
    const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
    if (JSON.stringify(stable(persisted)) !== JSON.stringify(stable(pack))) fail(503, 'Subject pack changed without a version increment');
    const id = uid();
    await ctx.q('INSERT INTO assessments(id,student_id,subject_version,stage,status,item_ids,intervention_id,created_at) VALUES($1,$2,$3,$4,$5,$6::json,$7,CURRENT_TIMESTAMP)',
      [id, sid, version, input.stage, 'open', JSON.stringify(items), input.intervention_id]);
    await audit(ctx, user, 'assessment.created');
    return ok(await assessmentView(ctx, await assessment(ctx, id, user)), 201);
  }
  if ((match = /^\/api\/assessments\/([^/]+)$/.exec(path)) && method === 'GET') {
    ctx.route = '/api/assessments/:id'; return ok(await assessmentView(ctx, await assessment(ctx, match[1], user)));
  }
  if ((match = /^\/api\/assessments\/([^/]+)\/responses$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/assessments/:id/responses';
    const input = await body(ctx, 'AnswerInput'), record = await assessment(ctx, match[1], user, true);
    await consent(ctx, record.student_id);
    if (record.status !== 'open') fail(409, 'Assessment already completed');
    if (!record.item_ids.includes(input.item_id)) fail(422, 'Item is not part of this assessment');
    if ((await ctx.q('SELECT id FROM responses WHERE assessment_id=$1 AND item_id=$2', [record.id, input.item_id])).length) fail(409, 'Original response is immutable; duplicate submission rejected');
    const pack = await packFor(ctx, record), item = pack.items.find(i => i.id === input.item_id);
    if (item.options.length && !item.options.includes(input.answer)) fail(422, 'Choose an approved option');
    const [correct, rubric] = grade(item, input.answer, input.reasoning, content), id = uid();
    await ctx.q('INSERT INTO responses(id,assessment_id,item_id,item_version,answer,reasoning,confidence,correct,rubric,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::json,CURRENT_TIMESTAMP)',
      [id, record.id, item.id, item.version, input.answer, input.reasoning, input.confidence, correct, JSON.stringify(rubric)]);
    await audit(ctx, user, 'response.recorded'); return ok({id, item_id: item.id, saved: true}, 201);
  }
  if ((match = /^\/api\/assessments\/([^/]+)\/complete$/.exec(path)) && method === 'POST') {
    ctx.route = '/api/assessments/:id/complete';
    const record = await assessment(ctx, match[1], user, true); await consent(ctx, record.student_id);
    const records = await responsesFor(ctx, record.id);
    if (records.length !== record.item_ids.length) fail(409, 'Answer every item before completing the assessment');
    if (record.status === 'completed') return ok(await assessmentView(ctx, record));
    if (['post', 'transfer', 'retention'].includes(record.stage)) {
      const intervention = (await ctx.q('SELECT * FROM interventions WHERE id=$1', [record.intervention_id]))[0];
      const baseline = (await ctx.q('SELECT * FROM assessments WHERE id=$1', [intervention.baseline_assessment_id]))[0];
      if (!baseline) fail(409, 'Baseline unavailable; follow-up comparison cannot be computed');
      const pack = await packFor(ctx, baseline), index = new Map(pack.items.map(i => [i.id, i]));
      const pre = (await responsesFor(ctx, baseline.id)).filter(r => index.get(r.item_id).concept_id === intervention.concept_id);
      const preScore = pre.length ? pre.filter(r => r.correct).length / pre.length : null;
      const postScore = records.filter(r => r.correct).length / records.length;
      const payload = {stage: record.stage, concept_id: intervention.concept_id, subject_id: pack.id,
        pre_n: pre.length, followup_n: records.length, pre_performance: preScore, followup_performance: postScore,
        descriptive_difference: preScore === null ? null : postScore - preScore,
        days_since_intervention: Math.floor((Date.now() - new Date(intervention.completed_at).getTime()) / 86400000),
        interpretation: 'Descriptive comparison on different, uncalibrated sample items; not an intervention effect or equated gain.'};
      await ctx.q('INSERT INTO learning_results(id,assessment_id,payload) VALUES($1,$2,$3::json)', [uid(), record.id, JSON.stringify(payload)]);
    }
    await ctx.q("UPDATE assessments SET status='completed' WHERE id=$1", [record.id]);
    await audit(ctx, user, 'assessment.completed');
    return ok(await assessmentView(ctx, {...record, status: 'completed'}));
  }
  return null;
}

