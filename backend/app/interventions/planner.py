def recommend(pack, concept_id: str) -> dict:
    concept = next(c for c in pack.concepts if c.id == concept_id)
    item = next(i for i in pack.items if i.concept_id == concept_id)
    return {'concept_id': concept_id, 'activity': f'Work through two contrasting examples of {concept.name}. Explain each step, then compare against this objective: {item.objective}',
            'expected_outcome': item.objective, 'teacher_review_required': True,
            'basis': 'Sample subject-pack objective; teacher should adapt to observed evidence.'}
