from app.diagnostics.evidence_analyzer import analyze
from app.analytics.bottleneck_scoring import prioritize
from app.knowledge_graph.graph_engine import traverse

ENGINE_VERSION = 'rules-v2'


def diagnose(pack, responses) -> tuple[list[dict], list[dict]]:
    evidence = analyze(pack, responses)
    hypotheses = []
    for e in evidence:
        cid, n, wrong = e['concept_id'], e['count'], e['incorrect_count']
        common = {'concept_id': cid, 'source_response_ids': e['source_response_ids'], 'uncertainty': e['uncertainty'],
                  'priority': prioritize(pack, e), 'prerequisites_to_explore': traverse(pack, cid, reverse=True),
                  'causal_status': 'No causal conclusion; graph relationships are exploratory.'}
        candidates = []
        if n < 2:
            candidates.append(('insufficient_evidence', 'Too few distinct items to characterize understanding.', 'insufficient'))
        if wrong:
            candidates.append(('knowledge_gap', 'Incorrect answers suggest a possible knowledge gap; slips and task interpretation remain alternatives.', 'provisional'))
            candidates.append(('task_or_slip', 'A task interpretation difficulty or execution slip may explain incorrect answers.', 'provisional'))
        if e['flag_count']:
            candidates.append(('misconception', 'Reasoning contains a sample misconception phrase; negation and context require review.', 'provisional'))
        if e['correct_aligned_count'] < e['correct_count']:
            candidates.append(('reasoning_gap', 'Some correct answers lack matching rubric reasoning; guessing or paraphrase is possible.', 'provisional'))
        if wrong and e['correct_count']:
            candidates.append(('inconsistent_understanding', 'Correct and incorrect answers coexist across related tasks.', 'provisional'))
        if n >= 2 and not wrong and e['aligned_count'] == n and not e['flag_count']:
            candidates.append(('demonstrated_on_sample', 'Answers and lexical rubric align on these sampled tasks only.', 'observed'))
        for kind, why, status in candidates:
            hypotheses.append({**common, 'kind': kind, 'explanation': why, 'status': status,
                               'support': round(min(n / 4, .8) * (e['flag_count'] / n if kind == 'misconception' else wrong / n if kind == 'knowledge_gap' else .5), 3) if n else 0})
    return evidence, sorted(hypotheses, key=lambda h: h['priority']['score'], reverse=True)
