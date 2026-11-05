import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gemini, openrouter, priceClass, selectAutoModel, validateSuggestion} from '../src/ai.js';

const content = JSON.parse(readFileSync(new URL('../generated/content.json', import.meta.url)));
const context = {source_response_ids: ['R1'], rubrics: []};
const valid = {explanation: 'Teacher should review this evidence.', source_response_ids: ['R1'], suggestions: ['Review a worked example.'], candidate: null};
const ctx = () => ({requestId: 'synthetic-request', content, env: {GEMINI_API_KEY: 'synthetic-test-key', GEMINI_MODEL: 'configured-test-model'}});

test('pricing never misclassifies tiny positive decimal rates as free', () => {
  assert.equal(priceClass({prompt: '1e-10000', completion: '0'}), 'paid');
  assert.equal(priceClass({prompt: '0.000', completion: '-0e999'}), 'free');
  assert.equal(priceClass({prompt: 'NaN', completion: '0'}), 'unknown');
  assert.equal(priceClass({prompt: '-1', completion: '0'}), 'unknown');
});
test('auto routing excludes paid, unverified and expired models', () => {
  const model = (id, price_class = 'free', extra = {}) => ({id, price_class, supports_advisory: true, expiration_date: null, context_length: 1000, supported_parameters: ['reasoning'], ...extra});
  assert.equal(selectAutoModel([model('paid', 'paid'), model('expired', 'free', {expiration_date: '2030-01-01'}), model('free')], 'reasoning_analysis', 'paid', ''), 'free');
  assert.equal(selectAutoModel([model('unknown', 'unknown')], 'reasoning_analysis'), null);
});
test('unsupported evidence and altered candidate rubrics are rejected', () => {
  assert.throws(() => validateSuggestion({...valid, source_response_ids: ['invented']}, context, 'reasoning_analysis', content));
  const pack = Object.values(content.packs)[0], item = pack.items.find(i => i.stage === 'verification');
  const reference = {concept_id: item.concept_id, objective: item.objective, difficulty: item.difficulty, rubric: item.rubric};
  const input = {...valid, candidate: structuredClone(item)};
  assert.doesNotThrow(() => validateSuggestion(input, {...context, rubrics: [reference]}, 'verification_candidate', content));
  input.candidate.objective = 'unapproved objective';
  assert.throws(() => validateSuggestion(input, {...context, rubrics: [reference]}, 'verification_candidate', content));
});
test('Gemini retries upstream 504 three times before fallback and recovers without fabricated success', async () => {
  const realFetch = globalThis.fetch, realRandom = Math.random;
  Math.random = () => 0;
  try {
    for (const recover of [false, true]) {
      let attempts = 0, lookups = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(options.headers['x-goog-api-key'], 'synthetic-test-key');
        if (!url.includes(':generateContent')) { lookups++; return Response.json({supportedGenerationMethods: ['generateContent']}); }
        attempts++;
        if (!recover || attempts < 3) return Response.json({error: {status: 'DEADLINE_EXCEEDED'}}, {status: 504});
        return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(valid)}]}}]});
      };
      const result = await gemini(ctx(), 'reasoning_analysis', context);
      assert.equal(attempts, 3); assert.equal(lookups, 1); assert.equal(result.fallback, !recover);
      if (!recover) assert.match(result.fallback_reason, /HTTP 504/);
    }
  } finally { globalThis.fetch = realFetch; Math.random = realRandom; }
});
test('Gemini distinguishes client timeouts and rejects invalid citations without retrying validation', async () => {
  const realFetch = globalThis.fetch, realRandom = Math.random;
  Math.random = () => 0;
  try {
    let attempts = 0;
    globalThis.fetch = async url => {
      if (!url.includes(':generateContent')) return Response.json({supportedGenerationMethods: ['generateContent']});
      attempts++; throw new DOMException('synthetic timeout', 'TimeoutError');
    };
    const timeout = await gemini(ctx(), 'reasoning_analysis', context);
    assert.equal(attempts, 3); assert.match(timeout.fallback_reason, /TimeoutError/);
    attempts = 0;
    globalThis.fetch = async url => {
      if (!url.includes(':generateContent')) return Response.json({supportedGenerationMethods: ['generateContent']});
      attempts++; return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({...valid, source_response_ids: ['invented']})}]}}]});
    };
    assert.equal((await gemini(ctx(), 'reasoning_analysis', context)).fallback, true);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = realFetch; Math.random = realRandom; }
});
test('OpenRouter reports an actual provider failure as fallback', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({error: 'synthetic'}, {status: 503});
    const c = ctx(); c.env.OPENROUTER_API_KEY = 'synthetic-test-key';
    const result = await openrouter(c, 'reasoning_analysis', context, 'configured-test-model');
    assert.equal(result.fallback, true); assert.match(result.fallback_reason, /HTTP 503/);
  } finally { globalThis.fetch = original; }
});

