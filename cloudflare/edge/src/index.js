import {Client} from 'pg';
import content from '../generated/content.json';
import {HTTPError} from './kernel.js';
import {coreRoutes} from './core-routes.js';
import {learningRoutes} from './learning-routes.js';
import {researchRoutes} from './research-routes.js';
import {aiRoutes} from './ai-routes.js';

export default {
  async fetch(request, env) {
    const started = Date.now(), requestId = crypto.randomUUID(), url = new URL(request.url);
    const headers = new Headers({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Request-ID': requestId});
    let allowedOrigins;
    try {
      allowedOrigins = JSON.parse(env.CORS_ORIGINS);
      if (!Array.isArray(allowedOrigins) || !allowedOrigins.length || allowedOrigins.some(x => new URL(x).origin !== x || !x.startsWith('https://'))) throw new Error('Invalid origins');
    } catch { return Response.json({detail: 'Server configuration unavailable'}, {status: 503, headers}); }
    const origin = request.headers.get('Origin');
    if (allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Expose-Headers', 'X-Request-ID');
    }
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID');
      headers.set('Access-Control-Max-Age', '600');
      return new Response(null, {status: 204, headers});
    }
    const ctx = {request, env, content, requestId, path: url.pathname, url, route: '/unmatched'};
    let client, inTransaction = false, status = 500, result;
    try {
      if (!env.PASSWORD_PEPPER || env.PASSWORD_PEPPER.length < 32 || !env.HYPERDRIVE) throw new Error('Missing bindings');
      if (ctx.path !== '/health') {
        if (!env.REQUEST_LIMITER || !env.AUTH_LIMITER) throw new Error('Missing rate limiter');
        const key = request.headers.get('CF-Connecting-IP') || 'unavailable';
        if (!(await env.REQUEST_LIMITER.limit({key})).success ||
            (ctx.path.startsWith('/api/auth/') && request.method === 'POST' && !(await env.AUTH_LIMITER.limit({key})).success)) {
          headers.set('Retry-After', '60'); throw new HTTPError(429, 'Rate limit reached; retry in one minute');
        }
      }
      client = new Client({connectionString: env.HYPERDRIVE.connectionString, connectionTimeoutMillis: 5000,
        query_timeout: 10000, application_name: 'lba-edge'});
      await client.connect();
      ctx.q = async (text, values = []) => (await client.query(text, values)).rows;
      await ctx.q('BEGIN'); inTransaction = true;
      await ctx.q("SET LOCAL statement_timeout='8000ms'");
      result = await coreRoutes(ctx) || await learningRoutes(ctx) || await researchRoutes(ctx) || await aiRoutes(ctx);
      if (!result) throw new HTTPError(404, 'Not found');
      await ctx.q('COMMIT'); inTransaction = false;
      status = result.status;
    } catch (error) {
      if (inTransaction) { try { await client.query('ROLLBACK'); } catch { /* no student data or SQL in logs */ } }
      status = error instanceof HTTPError ? error.status : error.code === '23505' || error.code === '23503' ? 409 : 503;
      result = {data: {detail: error instanceof HTTPError ? error.message : status === 409 ? 'Conflicting record; refresh and retry' : 'Service temporarily unavailable'}};
      if (!(error instanceof HTTPError)) console.error(JSON.stringify({event: 'request_failed', request_id: requestId,
        failure_type: /^[A-Z0-9_]{5,30}$/.test(error.code || '') ? error.code : error.name}));
    } finally {
      if (client) { try { await client.end(); } catch { /* connection is never retained across requests */ } }
    }
    console.log(JSON.stringify({event: 'request_completed', request_id: requestId, status, method: request.method,
      route: ctx.route, duration_ms: Date.now() - started}));
    if (result.headers) for (const [key, value] of Object.entries(result.headers)) headers.set(key, value);
    return status === 204 ? new Response(null, {status, headers}) : new Response(result.raw ?? JSON.stringify(result.data), {status, headers});
  },
};

