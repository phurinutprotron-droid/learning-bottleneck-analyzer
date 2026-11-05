from types import SimpleNamespace
import pytest
from app.subjects.registry import MATHEMATICS as pack, PACKS
from app.diagnostics.evidence_analyzer import grade
from app.diagnostics.engine import diagnose
from app.diagnostics.verification_engine import select_verification, update_support
from app.knowledge_graph.graph_engine import validate_graph, traverse
from app.subjects.base_pack import Relationship
from app.analytics.evaluation_metrics import agreement, reliability
from app.analytics.bottleneck_scoring import DEFAULT_WEIGHTS, prioritize


def response(item, answer, reasoning, confidence=3, id='r1'):
    correct, rubric = grade(item, answer, reasoning)
    return SimpleNamespace(id=id, item_id=item.id, correct=correct, rubric=rubric, confidence=confidence)


@pytest.mark.parametrize('answer,reasoning,expected', [
    ('2/3', 'add to both', {'knowledge_gap', 'misconception'}),
    ('2/3', 'numerator', {'knowledge_gap'}),
    ('2/4', 'add to both', {'misconception', 'reasoning_gap'}),
    ('2/4', 'scale numerator and denominator by the same factor', set()),
])
def test_correctness_reasoning_cases(answer, reasoning, expected):
    evidence, hypotheses = diagnose(pack, [response(pack.items[0], answer, reasoning)])
    kinds = {h['kind'] for h in hypotheses}
    assert expected <= kinds
    assert 'insufficient_evidence' in kinds
    assert evidence[0]['source_response_ids'] == ['r1']


def test_confidence_does_not_create_misconception():
    for answer, confidence in [('2/3', 5), ('2/4', 1)]:
        _, hs = diagnose(pack, [response(pack.items[0], answer, 'I am unsure', confidence)])
        assert 'misconception' not in {h['kind'] for h in hs}


def test_confidence_does_not_change_diagnostic_outcome():
    low = diagnose(pack, [response(pack.items[0], '2/3', 'test', 1)])[1]
    high = diagnose(pack, [response(pack.items[0], '2/3', 'test', 5)])[1]
    assert low == high


def test_contradictory_evidence_and_competing_hypotheses():
    rs = [response(pack.items[0], '2/3', 'add to both', id='r1'), response(pack.items[1], '6', 'same numerator denominator', id='r2')]
    e, hs = diagnose(pack, rs)
    assert 'inconsistent_understanding' in {h['kind'] for h in hs}
    assert {'knowledge_gap', 'task_or_slip', 'misconception'} <= {h['kind'] for h in hs}
    assert e[0]['supporting_observations']['incorrect_ids'] == ['r1']
    assert e[0]['contradictory_observations']['correct_ids'] == ['r2']


def test_no_responses_is_insufficient_not_understood():
    _, hs = diagnose(pack, [])
    assert all(h['kind'] == 'insufficient_evidence' and h['priority']['score'] == 0 for h in hs)


def test_wrong_aligned_answer_does_not_mask_correct_answer_with_reasoning_gap():
    records = [
        response(pack.items[0], '2/3', 'same numerator denominator', id='incorrect'),
        response(pack.items[1], '6', 'I guessed', id='correct'),
    ]
    _, hypotheses = diagnose(pack, records)
    assert any(h['kind'] == 'reasoning_gap' for h in hypotheses)


def test_priority_weights_are_finite_and_weight_changes_are_traceable():
    evidence, _ = diagnose(pack, [response(pack.items[0], '2/3', 'I guessed')])
    with pytest.raises(ValueError, match='Weights'):
        prioritize(pack, evidence[0], weights={**DEFAULT_WEIGHTS, 'evidence': float('nan')})
    performance_only = dict.fromkeys(DEFAULT_WEIGHTS, 0.0)
    performance_only['performance'] = 1.0
    priority = prioritize(pack, evidence[0], weights=performance_only)
    assert priority['score'] == priority['components']['performance']['contribution'] == 100


def test_repeated_correct_rubric_alignment():
    _, hs = diagnose(pack, [response(i, i.answers[0], 'same numerator denominator', id=i.id) for i in pack.items[:2]])
    assert any(h['kind'] == 'demonstrated_on_sample' for h in hs)


def test_verification_can_contradict_initial_hypothesis():
    _, hs = diagnose(pack, [response(pack.items[0], '2/3', 'add to both')])
    item, selection = select_verification(pack, hs, set())
    r = response(item, item.answers[0], 'same numerator denominator', id='new')
    updates = update_support(hs, item, r)
    assert next(u for u in updates if u['kind'] == 'knowledge_gap')['verification_status'] == 'contradicted'
    assert 'knowledge_gap' in selection['competing_hypotheses']
    assert select_verification(pack, hs, {i.id for i in pack.items}) is None


def test_graph_validation_traversal_and_cycle():
    for p in PACKS.values():
        assert validate_graph(p)['valid']
    assert traverse(pack, 'mathematics.equations', reverse=True) == ['mathematics.fractions', 'mathematics.ratios']
    cyclic = pack.model_copy(deep=True)
    cyclic.relationships.append(Relationship(source_id='mathematics.equations', target_id='mathematics.fractions'))
    with pytest.raises(ValueError, match='cycle'):
        validate_graph(cyclic)


def test_statistics_missing_data_and_agreement():
    assert agreement(['a', 'b'], ['a', 'b'])['cohens_kappa'] == 1
    assert reliability([[1, 1], [1, 1]]) is None
    assert reliability([[1, 1], [0, 0]]) == 1
