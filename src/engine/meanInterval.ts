// 정규 모평균의 z·t 구간과 그 구간이 뒤집는 검정 (교재 8.2.1, 8.7 · PRD v2 E01·E02·E04).
// 기각 규칙은 "p < α이면 기각"으로 고정한다. 그러면 C(x) = {μ₀ : p(μ₀) ≥ α}는 닫힌 구간이 된다.
import { normCdf, normPpf, normSf } from './core/normal'
import { tCdf, tPpf, tSf } from './core/tdist'

/** z: σ를 안다 / t: σ를 S로 추정한다 */
export type Method = 'z' | 't'
/** 대립가설. greater(μ > μ₀)는 하한 [L, ∞), less(μ < μ₀)는 상한 (−∞, U]에 대응한다 */
export type Alt = 'two' | 'greater' | 'less'

export interface Interval {
  lower: number
  upper: number
}

/** 피벗 분포의 하측 분위수 Q_q */
export function pivotQuantile(method: Method, q: number, n: number): number {
  return method === 'z' ? normPpf(q) : tPpf(q, n - 1)
}

/** 구간에 쓰는 임계값: 양측 Q_{1−α/2}, 단측 Q_{1−α} */
export function criticalValue(method: Method, level: number, n: number, alt: Alt): number {
  const alpha = 1 - level
  return pivotQuantile(method, alt === 'two' ? 1 - alpha / 2 : 1 - alpha, n)
}

export function standardError(sd: number, n: number): number {
  return sd / Math.sqrt(n)
}

/** x̄ ± q·SE (단측이면 한쪽만). sd는 z에서 σ, t에서 S */
export function meanInterval(method: Method, xbar: number, sd: number, n: number, level: number, alt: Alt = 'two'): Interval {
  const se = standardError(sd, n)
  const q = criticalValue(method, level, n, alt)
  if (alt === 'greater') return { lower: xbar - q * se, upper: Infinity }
  if (alt === 'less') return { lower: -Infinity, upper: xbar + q * se }
  return { lower: xbar - q * se, upper: xbar + q * se }
}

export interface TestResult {
  /** 검정통계량 (x̄ − μ₀)/SE */
  stat: number
  p: number
  se: number
}

function pFromStat(method: Method, stat: number, n: number, alt: Alt): number {
  const sf = method === 'z' ? normSf : (x: number) => tSf(x, n - 1)
  const cdf = method === 'z' ? normCdf : (x: number) => tCdf(x, n - 1)
  if (alt === 'greater') return sf(stat)
  if (alt === 'less') return cdf(stat)
  return Math.min(1, 2 * sf(Math.abs(stat)))
}

/** H₀: μ = μ₀ 검정 */
export function meanTest(method: Method, xbar: number, sd: number, n: number, mu0: number, alt: Alt = 'two'): TestResult {
  const se = standardError(sd, n)
  const stat = (xbar - mu0) / se
  return { stat, p: pFromStat(method, stat, n, alt), se }
}

export function rejects(p: number, alpha: number): boolean {
  return p < alpha
}

export function contains(iv: Interval, v: number): boolean {
  return iv.lower <= v && v <= iv.upper
}

/** 채택역 A(μ₀): H₀: μ = μ₀를 기각하지 않는 x̄의 범위 (σ를 아는 z 검정) */
export function acceptanceRegion(mu0: number, se: number, level: number, alt: Alt = 'two'): Interval {
  const q = criticalValue('z', level, 2, alt)
  if (alt === 'greater') return { lower: -Infinity, upper: mu0 + q * se }
  if (alt === 'less') return { lower: mu0 - q * se, upper: Infinity }
  return { lower: mu0 - q * se, upper: mu0 + q * se }
}

/** 오차한계 E = Q_{1−α/2}·σ/√n */
export function marginOfError(sigma: number, n: number, level: number): number {
  return criticalValue('z', level, n, 'two') * standardError(sigma, n)
}

/** σ를 아는 양측 z 구간에서 오차한계가 E 이하가 되는 최소 n */
export function sampleSizeFor(sigma: number, E: number, level: number): number {
  const q = criticalValue('z', level, 2, 'two')
  return Math.ceil(((q * sigma) / E) ** 2 - 1e-9)
}
