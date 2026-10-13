import type { BenchmarkCriterion } from '../../services/candidate-benchmark.service'
export function benchmarkPriorities(criteria: BenchmarkCriterion[]) {
  return criteria
    .filter((c) => c.weight > 0 && (c.action === 'CLARIFY' || c.action === 'STRENGTHEN'))
    .sort(
      (a, b) =>
        Number(b.required && b.action === 'CLARIFY') -
          Number(a.required && a.action === 'CLARIFY') ||
        b.priority - a.priority ||
        a.name.localeCompare(b.name, 'vi'),
    )
    .slice(0, 3)
}
export function benchmarkNumber(value: number | null) {
  return value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}
