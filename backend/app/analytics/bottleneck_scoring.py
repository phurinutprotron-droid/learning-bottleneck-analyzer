from math import isfinite

from app.knowledge_graph.graph_engine import traverse

DEFAULT_WEIGHTS = {'evidence': .25, 'certainty': .15, 'repetition': .15, 'downstream': .10, 'performance': .25, 'verification': .10}


def prioritize(pack, evidence: dict, verified: bool = False, weights: dict | None = None) -> dict:
    weights = DEFAULT_WEIGHTS if weights is None else weights
    if set(weights) != set(DEFAULT_WEIGHTS) or any(not isfinite(v) or v < 0 for v in weights.values()) or abs(sum(weights.values()) - 1) > 1e-8:
        raise ValueError('Weights must be nonnegative, sum to one, and use all components')
    n = evidence['count']
    components = {'evidence': evidence['evidence_strength'], 'certainty': 1 - evidence['uncertainty'],
                  'repetition': min(evidence['incorrect_count'] / 3, 1),
                  'downstream': len(traverse(pack, evidence['concept_id'])) / max(len(pack.concepts) - 1, 1),
                  'performance': evidence['incorrect_count'] / n if n else 0,
                  'verification': 1.0 if verified else 0.0}
    return {'label': 'Heuristic priority — not a validated measurement',
            'score': round(100 * sum(weights[k] * v for k, v in components.items()), 1) if n else 0,
            'components': {k: {'value': round(v, 3), 'weight': weights[k], 'contribution': round(v * weights[k] * 100, 2)} for k, v in components.items()}}
