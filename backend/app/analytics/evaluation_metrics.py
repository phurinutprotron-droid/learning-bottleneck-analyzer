from collections import Counter
from math import sqrt


def agreement(reference: list[str], predicted: list[str]) -> dict:
    if len(reference) != len(predicted) or not reference:
        raise ValueError('Paired nonempty labels required')
    n = len(reference)
    observed = sum(a == b for a, b in zip(reference, predicted)) / n
    a, b = Counter(reference), Counter(predicted)
    expected = sum(a[k] * b[k] for k in a.keys() | b.keys()) / n ** 2
    return {'n': n, 'agreement': observed, 'cohens_kappa': (observed - expected) / (1 - expected) if expected < 1 else None}


def reliability(matrix: list[list[int]]) -> float | None:
    """Cronbach alpha for complete binary item matrices; undefined samples return None."""
    if len(matrix) < 2 or len(matrix[0]) < 2:
        return None
    k, n = len(matrix[0]), len(matrix)
    if any(len(row) != k or any(x not in (0, 1) for x in row) for row in matrix):
        raise ValueError('Complete rectangular binary response matrix required')
    def variance(xs):
        mean = sum(xs) / n
        return sum((x - mean) ** 2 for x in xs) / (n - 1)
    total = variance([sum(row) for row in matrix])
    return k / (k - 1) * (1 - sum(variance([row[j] for row in matrix]) for j in range(k)) / total) if total else None


def descriptive(values: list[float]) -> dict:
    n = len(values)
    mean = sum(values) / n if n else None
    se = sqrt(sum((x - mean) ** 2 for x in values) / (n - 1) / n) if n > 1 else None
    return {'n': n, 'mean': mean, 'standard_error': se}
