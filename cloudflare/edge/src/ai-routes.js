import {uid, fail, staff, researcher, readBody, validate, assessment, consent, packFor, responsesFor, audit} from './kernel.js';
import {runRecord} from './learning-routes.js';
import {generateExam} from './exam.js';
import {catalog, selectAutoModel, requireModel, deterministic, openrouter, gemini, qwenExam} from './ai.js';

export async function aiRoutes(ctx) {
  const {path, request, user, content} = ctx;
  let match;
  if (path === '/api/ai/models' && request.method === 'GET') {
    ctx.route = path; staff(user);
    const q = ctx.url.searchParams.get('q') || '', modality = ctx.url.searchParams.get('modality') || '';
    const rawContext = ctx.url.searchParams.get('minimum_context') || '0', flag = ctx.url.searchParams.get('free_only') || 'false';
    if ([...q].length > 100 || [...modality].length > 30 || !/^\d+$/.test(rawContext) || !Number.isSafeInteger(Number(rawContext)) || !['true', 'false', '1', '0'].includes(flag)) fail(422, 'Invalid model filter');
    return {status: 200, data: await catalog(ctx, {q, modality, minimum_context: Number(rawContext), free_only: ['true', '1'].includes(flag)})};
  }
  if (path === '/api/curriculum/status' && request.method === 'GET') {
    ctx.route = path; researcher(user);
    return {status: 200, data: content.curriculumStatus};
  }
  if (path === '/api/curriculum/exam-indicators' && request.method === 'GET') {
    ctx.route = path; staff(user); return {status: 200, data: content.indicators};
  }
  if (path === '/api/curriculum/exam-drafts' && request.method === 'POST') {
    ctx.route = path; staff(user);
    const input = validate(content.schemas.ExamDraftRequest, await readBody(request));
    return {status: 200, data: generateExam(input.indicator_id, input.count, input.seed, content)};
  }
  if (path === '/api/curriculum/ai-exam-drafts' && request.method === 'POST') {
    ctx.route = path; staff(user);
    const raw = await readBody(request);
    for (const key of ['code', 'excerpt']) if (typeof raw[key] === 'string') raw[key] = raw[key].trim();
    const input = validate(content.schemas.AIExamDraftRequest, raw), {count, allow_paid, ...context} = input;
    return {status: 200, data: await qwenExam(ctx, context, count)};
  }
  if ((match = /^\/api\/diagnostics\/([^/]+)\/ai-assist$/.exec(path)) && request.method === 'POST') {
    ctx.route = '/api/diagnostics/:id/ai-assist'; staff(user);
    const input = validate(content.schemas.AIInput, await readBody(request)), run = await runRecord(ctx, match[1]);
    const record = await assessment(ctx, run.assessment_id, user); await consent(ctx, record.student_id);
    const pack = await packFor(ctx, record), responses = await responsesFor(ctx, record.id), items = new Map(pack.items.map(i => [i.id, i]));
    const context = {source_response_ids: responses.map((r, i) => 'R' + (i + 1)),
      observations: responses.map((r, i) => ({source_id: 'R' + (i + 1), concept_id: items.get(r.item_id).concept_id, correct: r.correct, rubric_observations: r.rubric})),
      rubrics: pack.concepts.map(c => { const item = pack.items.find(i => i.concept_id === c.id); return {concept_id: c.id, objective: item.objective, difficulty: 'introductory', rubric: item.rubric}; })};
    let taskModels;
    try { taskModels = JSON.parse(ctx.env.OPENROUTER_TASK_MODELS || '{}'); } catch { fail(503, 'Server model configuration unavailable'); }
    const configured = taskModels[input.operation] || ctx.env.OPENROUTER_MODEL || '';
    let result;
    if (input.gemini_analysis) {
      if (input.model_id || input.auto_model || input.operation !== 'reasoning_analysis') fail(422, 'Gemini evidence analysis requires the reasoning_analysis task');
      result = await gemini(ctx, input.operation, context);
    } else if (input.model_id) {
      if (!ctx.env.OPENROUTER_API_KEY) fail(503, 'OpenRouter is not configured on the server');
      await requireModel(ctx, input.model_id, input.allow_paid);
      result = await openrouter(ctx, input.operation, context, input.model_id);
    } else if (input.auto_model) {
      let selected = null;
      if (ctx.env.OPENROUTER_API_KEY) {
        try { selected = selectAutoModel(await catalog(ctx, {free_only: true}), input.operation, taskModels[input.operation] || '', ctx.env.OPENROUTER_MODEL || ''); }
        catch (error) { if (error.status !== 503) throw error; }
      }
      result = selected ? await openrouter(ctx, input.operation, context, selected) : {...deterministic(input.operation, context), fallback_reason: 'No eligible free OpenRouter model could be selected'};
    } else if (ctx.env.AI_PROVIDER === 'openrouter') result = await openrouter(ctx, input.operation, context, configured);
    else if (ctx.env.AI_PROVIDER === 'gemini') result = await gemini(ctx, input.operation, context);
    else result = deterministic(input.operation, context);
    result.source_mapping = Object.fromEntries(responses.map((r, i) => ['R' + (i + 1), r.id]));
    await ctx.q('INSERT INTO ai_reviews(id,run_id,payload,created_at) VALUES($1,$2,$3::json,CURRENT_TIMESTAMP)', [uid(), run.id, JSON.stringify(result)]);
    await audit(ctx, user, 'ai.advisory_requested');
    return {status: 200, data: result};
  }
  return null;
}

