import {pythonSum} from './algorithms.js';
export function descriptive(values) {
  const n = values.length, mean = n ? pythonSum(values) / n : null;
  return {n, mean, standard_error: n > 1 ? Math.sqrt(pythonSum(values.map(x => (x - mean) ** 2)) / (n - 1) / n) : null};
}
export function reliability(matrix) {
  if (matrix.length < 2 || matrix[0].length < 2) return null;
  const k = matrix[0].length, n = matrix.length;
  if (matrix.some(row => row.length !== k || row.some(x => x !== 0 && x !== 1))) throw new Error('Complete rectangular binary response matrix required');
  const variance = xs => { const mean = pythonSum(xs) / n; return pythonSum(xs.map(x => (x - mean) ** 2)) / (n - 1); };
  const total = variance(matrix.map(row => pythonSum(row)));
  return total ? k / (k - 1) * (1 - pythonSum(Array.from({length: k}, (_, j) => variance(matrix.map(row => row[j])))) / total) : null;
}
export function agreement(reference, predicted) {
  if (!reference.length || reference.length !== predicted.length) throw new Error('Paired nonempty labels required');
  const n = reference.length, observed = reference.filter((label, i) => label === predicted[i]).length / n;
  const count = rows => rows.reduce((map, label) => map.set(label, (map.get(label) || 0) + 1), new Map());
  const a = count(reference), b = count(predicted);
  const expected = [...new Set([...a.keys(), ...b.keys()])].reduce((sum, k) => sum + (a.get(k) || 0) * (b.get(k) || 0), 0) / n ** 2;
  return {n, agreement: observed, cohens_kappa: expected < 1 ? (observed - expected) / (1 - expected) : null};
}

