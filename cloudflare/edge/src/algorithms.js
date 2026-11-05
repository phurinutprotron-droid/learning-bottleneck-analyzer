// Contract parity is checked against generated Python fixtures before packaging.
export function pyRound(value, places) {
  if (!Number.isFinite(value)) throw new Error('Non-finite value');
  if (value === 0) return 0;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(value));
  const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n);
  let numerator = (bits & ((1n << 52n) - 1n)) | (exponent ? 1n << 52n : 0n);
  const power = (exponent || 1) - 1023 - 52;
  const scale = 10n ** BigInt(places);
  numerator *= scale;
  const denominator = power < 0 ? 1n << BigInt(-power) : 1n;
  if (power > 0) numerator <<= BigInt(power);
  let quotient = numerator / denominator;
  const twiceRemainder = (numerator % denominator) * 2n;
  if (twiceRemainder > denominator || (twiceRemainder === denominator && quotient % 2n)) quotient++;
  return (value < 0 ? -1 : 1) * Number(quotient) / Number(scale);
}

export const casefold = (value, content) => [...value].map(c => content.casefoldExceptions[c] ?? c.toLowerCase()).join('');
export function normalize(value, content) {
  const folded = casefold(value, content);
  const whitespace = new Set(content.whitespace);
  return folded.split('').map(c => whitespace.has(c) ? ' ' : c).join('').split(' ').filter(Boolean).join(' ');
}

function contains(text, phrase) {
  for (let start = text.indexOf(phrase); start >= 0; start = text.indexOf(phrase, start + 1)) {
    const before = text.slice(0, start), after = text.slice(start + phrase.length);
    if (!/[\p{L}\p{N}_]$/u.test(before) && !/^[\p{L}\p{N}_]/u.test(after)) return true;
  }
  return false;
}

export function grade(item, answer, reasoning, content) {
  const text = normalize(reasoning, content), norm = value => normalize(value, content);
  const matched = item.rubric.required_groups.filter(group => group.some(term => contains(text, norm(term))));
  const errors = item.rubric.misconception_terms.filter(term => contains(text, norm(term)));
  const ratio = matched.length / item.rubric.required_groups.length;
  return [item.answers.some(a => norm(a) === norm(answer)), {
    alignment: errors.length ? 'contradictory' : ratio === 1 ? 'aligned' : ratio ? 'partial' : 'unmatched',
    matched_groups: matched.length, total_groups: item.rubric.required_groups.length,
    misconception_terms: errors, rubric_score: ratio,
    limitation: 'Keyword matching can miss paraphrases and negation; teacher review required.',
  }];
}

export function traverse(pack, concept, reverse = false) {
  const graph = new Map(pack.concepts.map(c => [c.id, new Set()]));
  if (!graph.has(concept)) throw new Error('Unknown concept');
  for (const edge of pack.relationships) if (edge.relationship_type === 'prerequisite') {
    graph.get(reverse ? edge.target_id : edge.source_id).add(reverse ? edge.source_id : edge.target_id);
  }
  const seen = new Set(), pending = [...graph.get(concept)];
  while (pending.length) {
    const current = pending.pop();
    if (!seen.has(current)) { seen.add(current); pending.push(...[...graph.get(current)].filter(c => !seen.has(c))); }
  }
  seen.delete(concept);
  return [...seen].sort();
}

const DEFAULT_WEIGHTS = {evidence: .25, certainty: .15, repetition: .15, downstream: .10, performance: .25, verification: .10};
export function pythonSum(values) {
  // CPython 3.12+ compensates floating point summation before rounding priorities.
  let high = 0, low = 0;
  for (const value of values) {
    const next = high + value;
    low += Math.abs(high) >= Math.abs(value) ? (high - next) + value : (value - next) + high;
    high = next;
  }
  return high + low;
}
export function prioritize(pack, evidence, verified = false, weights = DEFAULT_WEIGHTS) {
  if (Object.keys(weights).sort().join() !== Object.keys(DEFAULT_WEIGHTS).sort().join() ||
      Object.values(weights).some(v => !Number.isFinite(v) || v < 0) ||
      Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) > 1e-8) throw new Error('Invalid priority weights');
  const n = evidence.count;
  const components = {evidence: evidence.evidence_strength, certainty: 1 - evidence.uncertainty,
    repetition: Math.min(evidence.incorrect_count / 3, 1),
    downstream: traverse(pack, evidence.concept_id).length / Math.max(pack.concepts.length - 1, 1),
    performance: n ? evidence.incorrect_count / n : 0, verification: verified ? 1 : 0};
  return {label: 'Heuristic priority — not a validated measurement',
    score: n ? pyRound(100 * pythonSum(Object.entries(components).map(([key, value]) => weights[key] * value)), 1) : 0,
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key,
      {value: pyRound(value, 3), weight: weights[key], contribution: pyRound(value * weights[key] * 100, 2)}]))};
}

export function analyze(pack, responses) {
  const items = new Map(pack.items.map(i => [i.id, i]));
  return pack.concepts.map(concept => {
    const records = responses.filter(r => items.get(r.item_id).concept_id === concept.id);
    const correct = records.filter(r => r.correct).map(r => r.id), wrong = records.filter(r => !r.correct).map(r => r.id);
    const aligned = records.filter(r => r.rubric.alignment === 'aligned').map(r => r.id);
    const flags = records.filter(r => r.rubric.misconception_terms.length).map(r => r.id);
    const strength = Math.min(records.length / 4, 1);
    return {concept_id: concept.id, evidence_type: 'response_pattern', source_response_ids: records.map(r => r.id),
      supporting_observations: {incorrect_ids: wrong, rubric_flag_ids: flags},
      contradictory_observations: {correct_ids: correct, rubric_aligned_ids: aligned}, count: records.length,
      correct_count: correct.length, incorrect_count: wrong.length, flag_count: flags.length, aligned_count: aligned.length,
      correct_aligned_count: records.filter(r => r.correct && r.rubric.alignment === 'aligned').length,
      evidence_strength: strength, uncertainty: pyRound(1 - strength * (wrong.length && correct.length ? .5 : .8), 3),
      confidence_observations: records.map(r => ({response_id: r.id, confidence: r.confidence, correct: r.correct})),
      stage_observations: records.map(r => ({response_id: r.id, item_id: r.item_id, stage: items.get(r.item_id).stage,
        correct: r.correct, alignment: r.rubric.alignment})),
      explanation: `${correct.length}/${records.length} answers correct; ${flags.length} lexical misconception flags. Confidence is descriptive only.`};
  });
}

export function diagnose(pack, responses) {
  const evidence = analyze(pack, responses), hypotheses = [];
  for (const e of evidence) {
    const common = {concept_id: e.concept_id, source_response_ids: e.source_response_ids, uncertainty: e.uncertainty,
      priority: prioritize(pack, e), prerequisites_to_explore: traverse(pack, e.concept_id, true),
      causal_status: 'No causal conclusion; graph relationships are exploratory.'};
    const candidates = [], n = e.count, wrong = e.incorrect_count;
    if (n < 2) candidates.push(['insufficient_evidence', 'Too few distinct items to characterize understanding.', 'insufficient']);
    if (wrong) candidates.push(
      ['knowledge_gap', 'Incorrect answers suggest a possible knowledge gap; slips and task interpretation remain alternatives.', 'provisional'],
      ['task_or_slip', 'A task interpretation difficulty or execution slip may explain incorrect answers.', 'provisional']);
    if (e.flag_count) candidates.push(['misconception', 'Reasoning contains a sample misconception phrase; negation and context require review.', 'provisional']);
    if (e.correct_aligned_count < e.correct_count) candidates.push(['reasoning_gap', 'Some correct answers lack matching rubric reasoning; guessing or paraphrase is possible.', 'provisional']);
    if (wrong && e.correct_count) candidates.push(['inconsistent_understanding', 'Correct and incorrect answers coexist across related tasks.', 'provisional']);
    if (n >= 2 && !wrong && e.aligned_count === n && !e.flag_count) candidates.push(['demonstrated_on_sample', 'Answers and lexical rubric align on these sampled tasks only.', 'observed']);
    for (const [kind, explanation, status] of candidates) hypotheses.push({...common, kind, explanation, status,
      support: n ? pyRound(Math.min(n / 4, .8) * (kind === 'misconception' ? e.flag_count / n : kind === 'knowledge_gap' ? wrong / n : .5), 3) : 0});
  }
  return [evidence, hypotheses.sort((a, b) => b.priority.score - a.priority.score)];
}

export function selectVerification(pack, hypotheses, used) {
  const candidates = [];
  for (const item of pack.items) {
    if (item.stage !== 'verification' || used.has(item.id)) continue;
    const relevant = hypotheses.filter(h => h.concept_id === item.concept_id && item.discriminates.includes(h.kind));
    if (!relevant.length) continue;
    const kinds = [...new Set(relevant.map(h => h.kind))].sort();
    const score = kinds.length + Math.max(...relevant.map(h => h.uncertainty)) + Math.max(...relevant.map(h => h.priority.score)) / 100;
    candidates.push({score, item, reason: {strategy: 'Discriminating coverage + uncertainty + priority heuristic', score: pyRound(score, 3),
      competing_hypotheses: kinds, concept_id: item.concept_id,
      distinguishing_evidence: 'Compare answer correctness and reasoning rubric alignment on a distinct curated item.',
      not_optimality_claim: 'This is not a validated information gain or optimal adaptive test.'}});
  }
  candidates.sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  return candidates[0] ?? null;
}

export function updateSupport(hypotheses, item, response) {
  return hypotheses.filter(h => h.concept_id === item.concept_id).map(h => {
    const aligned = response.rubric.alignment === 'aligned', flagged = !!response.rubric.misconception_terms.length;
    let status = 'inconclusive';
    if (h.kind === 'knowledge_gap') status = response.correct && aligned ? 'contradicted' : !response.correct ? 'supported' : 'inconclusive';
    if (h.kind === 'misconception') status = flagged ? 'supported' : response.correct && aligned ? 'contradicted' : 'inconclusive';
    if (h.kind === 'reasoning_gap') status = aligned && !flagged ? 'contradicted' : response.correct && !aligned ? 'supported' : 'inconclusive';
    if (h.kind === 'task_or_slip') status = response.correct && aligned ? 'supported' : 'inconclusive';
    const delta = status === 'supported' ? .2 : status === 'contradicted' ? -.2 : 0;
    return {kind: h.kind, concept_id: item.concept_id, previous_support: h.support,
      updated_support: pyRound(Math.max(0, Math.min(1, h.support + delta)), 3), verification_status: status,
      source_response_ids: [response.id], uncertainty: status !== 'inconclusive' ? Math.max(.2, h.uncertainty - .1) : h.uncertainty,
      explanation: 'One curated verification observation; further evidence and teacher judgment remain necessary.'};
  });
}

export function recommend(pack, conceptId) {
  const concept = pack.concepts.find(c => c.id === conceptId), item = pack.items.find(i => i.concept_id === conceptId);
  return {concept_id: conceptId,
    activity: `Work through two contrasting examples of ${concept.name}. Explain each step, then compare against this objective: ${item.objective}`,
    expected_outcome: item.objective, teacher_review_required: true,
    basis: 'Sample subject-pack objective; teacher should adapt to observed evidence.'};
}

