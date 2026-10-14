// E13 CDF 역산과 비유일성 (PRD v2 §7 E13, CB 9.2.3·9.3.1).
// X_i ~ Uniform(0, θ), M = max X_i. U = M/θ의 CDF는 uⁿ (0 ≤ u ≤ 1)로 θ와 무관한 피벗이다.
// P(a ≤ M/θ ≤ b) = bⁿ − aⁿ = 1 − α이면 θ ∈ [M/b, M/a]. b ∈ [(1−α)^{1/n}, 1]가 구간을 정한다.
import { Rng, deriveSeed } from './core/rng'
import type { Interval } from './meanInterval'

export function bMin(n: number, level: number): number {
  return level ** (1 / n)
}

/** b에 맞는 a = (bⁿ − (1 − α))^{1/n} */
export function aFor(b: number, n: number, level: number): number {
  return Math.max(0, b ** n - level) ** (1 / n)
}

export function uniformInterval(M: number, n: number, level: number, b: number): Interval {
  const a = aFor(b, n, level)
  return { lower: M / b, upper: a > 0 ? M / a : Infinity }
}

/** 중앙(등꼬리): a = (α/2)^{1/n}, b = (1 − α/2)^{1/n} */
export function centralB(n: number, level: number): number {
  return (1 - (1 - level) / 2) ** (1 / n)
}

/** CDF 역산: F(m | θ) = (m/θ)ⁿ (θ ≥ m). F(m|θ_U) = α_U, F(m|θ_L) = 1 − α_L를 풀면 같은 구간 */
export function cdfAt(m: number, theta: number, n: number): number {
  return theta <= m ? 1 : (m / theta) ** n
}

export function cdfInversion(m: number, n: number, aL: number, aU: number): Interval {
  // θ에 대해 감소: 큰 θ일수록 F가 작다
  return { lower: m / (1 - aL) ** (1 / n), upper: aU > 0 ? m / aU ** (1 / n) : Infinity }
}

/** 길이 M(1/a − 1/b)를 최소로 하는 b (b = 1임을 수치로 확인한다) */
export function shortestB(n: number, level: number, M = 1): number {
  const lo = bMin(n, level) + 1e-12
  let best = 1
  let bestLen = Infinity
  for (let i = 0; i <= 20000; i++) {
    const b = lo + ((1 - lo) * i) / 20000
    const iv = uniformInterval(M, n, level, b)
    const len = iv.upper - iv.lower
    if (len < bestLen) {
      bestLen = len
      best = b
    }
  }
  return best
}

export const UNIF_STREAM = 0x756e6966 // 'unif'

/** 반복 b의 최댓값 M ~ θ·U^{1/n} */
export function maxReplicates(seed: number, from: number, to: number, n: number, theta: number): Float64Array {
  const out = new Float64Array(Math.max(0, to - from))
  for (let j = 0; j < out.length; j++) {
    const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, UNIF_STREAM), from + j))
    let m = 0
    for (let i = 0; i < n; i++) m = Math.max(m, theta * rng.next())
    out[j] = m
  }
  return out
}
