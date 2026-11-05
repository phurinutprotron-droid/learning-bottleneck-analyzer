export class HTTPError extends Error {
  constructor(status, detail) { super(detail); this.name = 'HTTPError'; this.status = status; }
}
export const uid = () => crypto.randomUUID();
export const fail = (status, detail) => { throw new HTTPError(status, detail); };
export const PASSWORD_PREFIX = 'pg-bcrypt-hmac-sha384-v1:';
export const DUMMY_HASH = '$2a$12$s60X1FrrVfvDznhdzgG18Ov.k9s.VXEem1bgwA57KNJ/zUJhxYTlm';
export const BCRYPT = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/;

export async function prehash(password, pepper) {
  if (typeof pepper !== 'string' || pepper.length < 32) throw new Error('Password configuration unavailable');
  const encode = value => new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey('raw', encode(pepper), {name: 'HMAC', hash: 'SHA-384'}, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, encode(password)))));
}

export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function newToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(48)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function readBody(request, limit = 65536) {
  if (Number(request.headers.get('Content-Length') || 0) > limit) fail(413, 'Request body too large');
  if (!request.body) fail(422, 'JSON body required');
  const reader = request.body.getReader(), chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); fail(413, 'Request body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { fail(422, 'Invalid JSON body'); }
}

export function validate(schema, value, root = schema) {
  if (schema.$ref) return validate(root.$defs[schema.$ref.split('/').at(-1)], value, root);
  if (schema.anyOf) {
    for (const option of schema.anyOf) { try { return validate(option, value, root); } catch (e) { if (!(e instanceof HTTPError)) throw e; } }
    fail(422, 'Value does not match the required type');
  }
  const type = schema.type;
  if (type === 'null') { if (value !== null) fail(422, 'Expected null'); return null; }
  if (type === 'object') {
    if (value === null || Array.isArray(value) || typeof value !== 'object') fail(422, 'Expected object');
    const properties = schema.properties || {};
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(422, 'Missing field: ' + key);
    if (schema.additionalProperties === false && Object.keys(value).some(k => !Object.hasOwn(properties, k))) fail(422, 'Unexpected field');
    const result = Object.create(null);
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) result[key] = validate(child, value[key], root);
      else if (Object.hasOwn(child, 'default')) result[key] = structuredClone(child.default);
    }
    if (schema.additionalProperties !== false) for (const [key, item] of Object.entries(value)) {
      if (!Object.hasOwn(properties, key) && (schema.additionalProperties !== undefined || !schema.properties)) result[key] = typeof schema.additionalProperties === 'object' ? validate(schema.additionalProperties, item, root) : item;
    }
    return result;
  }
  if (type === 'array') {
    if (!Array.isArray(value) || (schema.minItems !== undefined && value.length < schema.minItems) ||
        (schema.maxItems !== undefined && value.length > schema.maxItems)) fail(422, 'Invalid array');
    return value.map(item => validate(schema.items || {}, item, root));
  }
  if (type === 'string') {
    if (typeof value !== 'string') fail(422, 'Expected string');
    const length = [...value].length;
    if ((schema.minLength !== undefined && length < schema.minLength) ||
        (schema.maxLength !== undefined && length > schema.maxLength) ||
        (schema.pattern && !new RegExp(schema.pattern, 'u').test(value))) fail(422, 'Invalid string value');
  }
  if (type === 'boolean' && typeof value !== 'boolean') fail(422, 'Expected boolean');
  if (type === 'integer' || type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (type === 'integer' && !Number.isInteger(value)) ||
        (schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) fail(422, 'Invalid numeric value');
  }
  if (schema.enum && !schema.enum.includes(value)) fail(422, 'Unsupported value');
  if (Object.hasOwn(schema, 'const') && schema.const !== value) fail(422, 'Unsupported value');
  return value;
}

export const staff = user => { if (user.role !== 'teacher') fail(403, 'Teacher access required'); };
export const researcher = user => { if (!['teacher', 'researcher'].includes(user.role)) fail(403, 'Research access required'); };

export async function currentUser(ctx) {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(ctx.request.headers.get('Authorization') || '');
  if (!match) fail(401, 'Authentication required');
  const rows = await ctx.q('SELECT u.id,u.handle,u.role,u.is_demo,st.id AS student_id,st.anonymous_id FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN students st ON st.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at > CURRENT_TIMESTAMP', [await digest(match[1])]);
  if (!rows[0] || rows[0].is_demo) fail(401, 'Session invalid or expired');
  ctx.sessionToken = match[1];
  return rows[0];
}

export async function student(ctx, id, user) {
  const rows = await ctx.q('SELECT * FROM students WHERE id=$1', [id]);
  if (!rows[0]) fail(404, 'Student not found');
  if (user.role !== 'teacher' && rows[0].user_id !== user.id) fail(403, 'Student record access denied');
  return rows[0];
}
export async function assessment(ctx, id, user, lock = false) {
  const rows = await ctx.q('SELECT * FROM assessments WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [id]);
  if (!rows[0]) fail(404, 'Assessment not found');
  await student(ctx, rows[0].student_id, user);
  return rows[0];
}
export async function consent(ctx, studentId) {
  const rows = await ctx.q('SELECT * FROM consents WHERE student_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [studentId]);
  if (!rows[0]?.granted || rows[0].version !== 'pilot-v1') fail(409, 'Current consent required before collecting assessment data');
  return rows[0];
}
export async function audit(ctx, user, action) {
  await ctx.q('INSERT INTO audit_logs(id,actor_id,action,created_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)', [uid(), user.id, action]);
}
export async function identity(ctx, user) {
  const row = Object.hasOwn(user, 'student_id') ? {id: user.student_id, anonymous_id: user.anonymous_id} : (await ctx.q('SELECT * FROM students WHERE user_id=$1', [user.id]))[0];
  return {id: user.id, handle: user.handle, role: user.role, is_demo: user.is_demo,
    student_id: row?.id ?? null, anonymous_id: row?.anonymous_id ?? null};
}
export async function issueSession(ctx, user, action = 'session.created') {
  const token = newToken();
  await ctx.q("WITH new_session AS (INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP + INTERVAL '8 hours')) INSERT INTO audit_logs(id,actor_id,action,created_at) VALUES($3,$2,$4,CURRENT_TIMESTAMP)", [await digest(token), user.id, uid(), action]);
  return {access_token: token, token_type: 'bearer', user: await identity(ctx, user)};
}
export async function packFor(ctx, record) {
  const row = (await ctx.q('SELECT snapshot FROM subject_versions WHERE id=$1', [record.subject_version]))[0];
  if (!row) fail(503, 'Subject version unavailable');
  return row.snapshot;
}
export const responsesFor = (ctx, id) => ctx.q('SELECT * FROM responses WHERE assessment_id=$1 ORDER BY created_at,id', [id]);
export function publicItem(item) {
  const {answers, rubric, discriminates, ...rest} = item;
  return rest;
}
export async function assessmentView(ctx, record) {
  const pack = await packFor(ctx, record), responses = await responsesFor(ctx, record.id);
  const index = new Map(pack.items.map(item => [item.id, item]));
  return {id: record.id, student_id: record.student_id, subject_id: pack.id, subject_version: record.subject_version,
    graph_version: pack.graph_version, stage: record.stage, status: record.status, created_at: record.created_at,
    intervention_id: record.intervention_id, review_status: pack.review_status,
    items: record.item_ids.map(id => publicItem(index.get(id))), responses: responses.map(r => ({id: r.id, item_id: r.item_id,
      answer: r.answer, reasoning: r.reasoning, confidence: r.confidence,
      ...(record.status === 'completed' ? {correct: r.correct, rubric: r.rubric} : {})}))};
}

