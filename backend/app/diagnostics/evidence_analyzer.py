import re
from app.subjects.base_pack import Item


def normalize(value: str) -> str:
    return ' '.join(value.strip().casefold().split())


def contains(text: str, phrase: str) -> bool:
    return bool(re.search(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', text))


def grade(item: Item, answer: str, reasoning: str) -> tuple[bool, dict]:
    """Approved lexical rubric; flags observations, not semantic truth or expert judgments."""
    text = normalize(reasoning)
    matched = [group for group in item.rubric.required_groups if any(contains(text, normalize(term)) for term in group)]
    errors = [term for term in item.rubric.misconception_terms if contains(text, normalize(term))]
    ratio = len(matched) / len(item.rubric.required_groups)
    alignment = 'contradictory' if errors else 'aligned' if ratio == 1 else 'partial' if ratio else 'unmatched'
    return normalize(answer) in [normalize(a) for a in item.answers], {
        'alignment': alignment, 'matched_groups': len(matched), 'total_groups': len(item.rubric.required_groups),
        'misconception_terms': errors, 'rubric_score': ratio,
        'limitation': 'Keyword matching can miss paraphrases and negation; teacher review required.',
    }


def analyze(pack, responses) -> list[dict]:
    evidence = []
    for concept in pack.concepts:
        records = [r for r in responses if pack.item(r.item_id).concept_id == concept.id]
        correct = [r.id for r in records if r.correct]
        wrong = [r.id for r in records if not r.correct]
        aligned = [r.id for r in records if r.rubric['alignment'] == 'aligned']
        correct_aligned = sum(r.correct and r.rubric['alignment'] == 'aligned' for r in records)
        flags = [r.id for r in records if r.rubric['misconception_terms']]
        count = len(records)
        strength = min(count / 4, 1.0)
        uncertainty = round(1 - strength * (0.5 if wrong and correct else 0.8), 3)
        evidence.append({
            'concept_id': concept.id, 'evidence_type': 'response_pattern', 'source_response_ids': [r.id for r in records],
            'supporting_observations': {'incorrect_ids': wrong, 'rubric_flag_ids': flags},
            'contradictory_observations': {'correct_ids': correct, 'rubric_aligned_ids': aligned},
            'count': count, 'correct_count': len(correct), 'incorrect_count': len(wrong), 'flag_count': len(flags),
            'aligned_count': len(aligned), 'correct_aligned_count': correct_aligned,
            'evidence_strength': strength, 'uncertainty': uncertainty,
            'confidence_observations': [{'response_id': r.id, 'confidence': r.confidence, 'correct': r.correct} for r in records],
            'stage_observations': [
                {'response_id': r.id, 'item_id': r.item_id, 'stage': pack.item(r.item_id).stage,
                 'correct': r.correct, 'alignment': r.rubric['alignment']}
                for r in records
            ],
            'explanation': f'{len(correct)}/{count} answers correct; {len(flags)} lexical misconception flags. Confidence is descriptive only.',
        })
    return evidence
