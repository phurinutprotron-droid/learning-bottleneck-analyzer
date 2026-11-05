import {researcher, fail, readBody, validate, audit} from './kernel.js';
import {descriptive, reliability, agreement} from './metrics.js';

export async function datasetSummary(ctx, includeDemo) {
  const students = await ctx.q('SELECT s.id FROM students s JOIN users u ON u.id=s.user_id WHERE ($1::boolean OR NOT u.is_demo)', [includeDemo]);
  const ids = students.map(s => s.id);
  const assessments = await ctx.q('SELECT * FROM assessments WHERE student_id=ANY($1::varchar[])', [ids]);
  const assessmentIds = assessments.map(a => a.id);
  const responses = await ctx.q('SELECT assessment_id,item_id,correct FROM responses WHERE assessment_id=ANY($1::varchar[]) ORDER BY item_id', [assessmentIds]);
  const results = await ctx.q('SELECT payload FROM learning_results WHERE assessment_id=ANY($1::varchar[])', [assessmentIds]);
  const verifications = await ctx.q('SELECT result FROM verifications WHERE result IS NOT NULL AND assessment_id=ANY($1::varchar[])', [assessmentIds]);
  const runs = await ctx.q('SELECT COUNT(*)::int AS n FROM diagnostic_runs WHERE assessment_id=ANY($1::varchar[])', [assessmentIds]);
  const baselines = assessments.filter(a => a.stage === 'pre' && a.status === 'completed'), grouped = new Map();
  for (const record of baselines) {
    if (!grouped.has(record.subject_version)) grouped.set(record.subject_version, []);
    grouped.get(record.subject_version).push(responses.filter(r => r.assessment_id === record.id).map(r => Number(r.correct)));
  }
  const stages = Object.fromEntries(['post', 'transfer', 'retention'].map(stage => [stage, {
    performance: descriptive(results.filter(r => r.payload.stage === stage).map(r => r.payload.followup_performance)),
    descriptive_difference: descriptive(results.filter(r => r.payload.stage === stage && r.payload.descriptive_difference !== null).map(r => r.payload.descriptive_difference))}]));
  return {data_status: includeDemo ? 'Includes demonstration records; software testing only' : 'Demonstration accounts excluded; locally collected records are not validated research results',
    include_demo: includeDemo, students: students.length, responses: responses.length, completed_baselines: baselines.length,
    diagnostic_runs: runs[0].n, verification: {evaluated: verifications.length,
      with_contradictions: verifications.filter(v => v.result.updates.some(u => u.verification_status === 'contradicted')).length,
      interpretation: 'Frequency of contradictory observations, not diagnostic accuracy.'}, stages,
    reliability: [...grouped].map(([key, rows]) => ({subject_version: key, n: rows.length, cronbach_alpha: reliability(rows),
      interpretation: 'Exploratory internal consistency on this sample; not validity.'})), expert_agreement: null, usability: null,
    interpretation: 'Descriptive statistics only. Repeated observations are not independent participants. No causal effect established.'};
}

export async function researchRoutes(ctx) {
  if (!ctx.path.startsWith('/api/research/')) return null;
  ctx.route = ctx.path;
  researcher(ctx.user);
  const flag = ctx.url.searchParams.get('include_demo') || 'false';
  if (!['true', 'false', '1', '0'].includes(flag)) fail(422, 'Invalid boolean');
  const includeDemo = flag === 'true' || flag === '1';
  if (ctx.path === '/api/research/summary' && ctx.request.method === 'GET') return {status: 200, data: await datasetSummary(ctx, includeDemo)};
  if (ctx.path === '/api/research/export' && ctx.request.method === 'GET') {
    const data = await datasetSummary(ctx, includeDemo), rows = [['metric', 'stage', 'n', 'value', 'interpretation', 'dataset']];
    for (const [stage, group] of Object.entries(data.stages)) for (const [name, metric] of Object.entries(group)) rows.push([name, stage, metric.n, metric.mean,
      'descriptive; uncalibrated sample content; no causal claim', data.data_status]);
    rows.push(['verification_contradictions', '', data.verification.evaluated, data.verification.with_contradictions, 'not accuracy', data.data_status]);
    const csv = rows.map(row => row.map(value => { const text = value === null ? '' : String(value); return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text; }).join(',')).join('\r\n') + '\r\n';
    await audit(ctx, ctx.user, 'research.aggregate_exported');
    return {status: 200, raw: csv, headers: {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=lba-aggregate-report.csv'}};
  }
  if (ctx.path === '/api/research/evaluate' && ctx.request.method === 'POST') {
    const input = validate(ctx.content.schemas.EvaluationInput, await readBody(ctx.request, 1048576));
    input.sus_responses ||= [];
    if (input.reference_labels.length !== input.predicted_labels.length ||
        [...input.reference_labels, ...input.predicted_labels].some(label => [...label].length > 80) ||
        input.sus_responses.some(row => row.length !== 10 || row.some(v => !Number.isInteger(v) || v < 1 || v > 5))) fail(422, 'Paired labels and ten valid integer SUS ratings are required');
    const usability = input.sus_responses.map(row => row.reduce((sum, value, i) => sum + (i % 2 === 0 ? value - 1 : 5 - value), 0) * 2.5);
    await audit(ctx, ctx.user, 'research.metrics_computed');
    return {status: 200, data: {agreement: agreement(input.reference_labels, input.predicted_labels), sus: descriptive(usability),
      provenance: 'User-supplied paired labels and ratings; not independently validated or persisted.',
      interpretation: 'Reference agreement is not causal effectiveness. SUS is a usability score, not a percent correct.'}};
  }
  return null;
}

