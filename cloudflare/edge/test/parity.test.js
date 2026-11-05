import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grade, diagnose, selectVerification, updateSupport, pyRound, normalize} from '../src/algorithms.js';
import {prehash, validate, readBody, HTTPError} from '../src/kernel.js';
import {generateExam} from '../src/exam.js';
import {descriptive, reliability, agreement} from '../src/metrics.js';

const content = JSON.parse(readFileSync(new URL('../generated/content.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('../generated/parity.json', import.meta.url)));

test('every approved item matches Python grading across correct, incorrect and unmatched reasoning', () => {
  for (const c of fixtures.grading) {
    const item = content.packs[c.pack].items.find(i => i.id === c.item);
    assert.deepEqual(grade(item, c.answer, c.reasoning, content), c.expected, c.item);
  }
});
test('evidence, priority, hypotheses and verification match Python on synthetic response patterns', () => {
  for (const c of fixtures.diagnostics) {
    const pack = content.packs[c.pack], output = diagnose(pack, c.responses);
    assert.deepEqual(output, c.expected, c.pack);
    const selected = selectVerification(pack, output[1], new Set(c.responses.map(r => r.item_id)));
    if (c.verification === null) assert.equal(selected, null);
    else {
      assert.equal(selected.item.id, c.verification.item);
      assert.deepEqual(selected.reason, c.verification.reason);
      assert.deepEqual(updateSupport(output[1], selected.item, c.verification.response), c.verification.updates);
    }
  }
});
test('Python binary rounding and Unicode case folding preserve relevant boundary behavior', () => {
  assert.equal(pyRound(2.675, 2), 2.67);
  assert.equal(pyRound(6.25, 1), 6.2);
  assert.equal(pyRound(6.75, 1), 6.8);
  assert.equal(normalize('  STRAẞE\u001cΣς  ', content), 'strasse σσ');
});
test('native HMAC matches Python for long Thai passwords', async () => {
  assert.equal(await prehash(fixtures.hmac.password, fixtures.hmac.pepper), fixtures.hmac.expected);
  assert.notEqual(await prehash(fixtures.hmac.password + 'different', fixtures.hmac.pepper), fixtures.hmac.expected);
  await assert.rejects(prehash('password', ''), /configuration/);
});
test('request contracts reject role injection, wrong types and oversized strings', () => {
  const schema = content.schemas.Registration;
  assert.throws(() => validate(schema, {handle: 'student', password: 'password-123', role: 'teacher'}), HTTPError);
  assert.throws(() => validate(schema, {handle: 'student', password: 'password-123', grade: '7'}), HTTPError);
  assert.throws(() => validate(schema, {handle: 'student', password: 'x'.repeat(129)}), HTTPError);
  assert.equal(validate(schema, {handle: 'student', password: 'password-123'}).grade, 7);
});
test('chunked request bodies are bounded before JSON parsing', async () => {
  const stream = new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(40)); controller.enqueue(new Uint8Array(40)); controller.close(); }});
  await assert.rejects(readBody(new Request('https://lba.invalid', {method: 'POST', body: stream, duplex: 'half'}), 64), e => e.status === 413);
});
test('seeded curriculum drafts retain exact Python reproducibility', () => {
  for (const c of fixtures.exams) assert.deepEqual(generateExam(c.indicator, c.count, c.seed, content), c.expected);
});
test('research descriptive metrics match Python reference cases', () => {
  for (const c of fixtures.metrics) {
    assert.deepEqual(descriptive(c.values), c.descriptive);
    assert.equal(reliability(c.matrix), c.reliability);
    assert.deepEqual(agreement(c.labels, c.predictions), c.agreement);
  }
});

