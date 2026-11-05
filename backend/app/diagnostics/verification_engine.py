from app.subjects.base_pack import SubjectPack


def select_verification(pack: SubjectPack, hypotheses: list[dict], used: set[str]) -> tuple[object, dict] | None:
    """Coverage/uncertainty heuristic inspired by information gain, not an entropy estimate."""
    candidates = []
    for item in pack.items:
        if item.stage != 'verification' or item.id in used:
            continue
        relevant = [h for h in hypotheses if h['concept_id'] == item.concept_id and h['kind'] in item.discriminates]
        if not relevant:
            continue
        kinds = sorted({h['kind'] for h in relevant})
        uncertainty = max(h['uncertainty'] for h in relevant)
        priority = max(h['priority']['score'] for h in relevant) / 100
        score = len(kinds) + uncertainty + priority
        candidates.append((score, item.id, item, {'strategy': 'Discriminating coverage + uncertainty + priority heuristic',
            'score': round(score, 3), 'competing_hypotheses': kinds, 'concept_id': item.concept_id,
            'distinguishing_evidence': 'Compare answer correctness and reasoning rubric alignment on a distinct curated item.',
            'not_optimality_claim': 'This is not a validated information gain or optimal adaptive test.'}))
    if not candidates:
        return None
    _, _, item, reason = sorted(candidates, key=lambda c: (-c[0], c[1]))[0]
    return item, reason


def update_support(hypotheses: list[dict], item, response) -> list[dict]:
    updates = []
    for hypothesis in hypotheses:
        if hypothesis['concept_id'] != item.concept_id:
            continue
        kind = hypothesis['kind']
        aligned = response.rubric['alignment'] == 'aligned'
        flagged = bool(response.rubric['misconception_terms'])
        status = 'inconclusive'
        if kind == 'knowledge_gap':
            status = 'contradicted' if response.correct and aligned else 'supported' if not response.correct else 'inconclusive'
        elif kind == 'misconception':
            status = 'supported' if flagged else 'contradicted' if response.correct and aligned else 'inconclusive'
        elif kind == 'reasoning_gap':
            status = 'contradicted' if aligned and not flagged else 'supported' if response.correct and not aligned else 'inconclusive'
        elif kind == 'task_or_slip':
            status = 'supported' if response.correct and aligned else 'inconclusive'
        delta = .2 if status == 'supported' else -.2 if status == 'contradicted' else 0
        updates.append({'kind': kind, 'concept_id': item.concept_id, 'previous_support': hypothesis['support'],
                        'updated_support': round(max(0, min(1, hypothesis['support'] + delta)), 3), 'verification_status': status,
                        'source_response_ids': [response.id], 'uncertainty': max(.2, hypothesis['uncertainty'] - .1) if status != 'inconclusive' else hypothesis['uncertainty'],
                        'explanation': 'One curated verification observation; further evidence and teacher judgment remain necessary.'})
    return updates
