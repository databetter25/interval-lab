// E07 같은 구간, 세 관점 (PRD v2 §7 E07): 정규 모평균, σ 알려짐.
// 표기: N(a, b)에서 b는 분산이다. 피듀셜 분포의 변수는 μ*로 쓴다.
import { Rng, deriveSeed } from './core/rng'
import { normCdf, normPpf } from './core/normal'
import type { Interval } from './meanInterval'

export type Prior = { kind: 'flat' } | { kind: 'normal'; m0: number; tau0: number }

export interface NormalDist {
  mean: number
  /** 분산 */
  variance: number
}

/** 사후분포 μ | x. 평탄 사전 π(μ) ∝ 1은 비정칙이지만 사후분포 N(x̄, σ²/n)은 정칙이다 */
export function posterior(xbar: number, sigma: number, n: number, prior: Prior): NormalDist {
  const v = (sigma * sigma) / n
  if (prior.kind === 'flat') return { mean: xbar, variance: v }
  const t2 = prior.tau0 * prior.tau0
  const vn = 1 / (n / (sigma * sigma) + 1 / t2)
  return { mean: vn * ((n * xbar) / (sigma * sigma) + prior.m0 / t2), variance: vn }
}

/** 피듀셜 분포: X̄ = μ + SE·Z를 뒤집어 μ* = x̄ − SE·Z ~ N(x̄, SE²). 사전분포를 쓰지 않는다 */
export function fiducial(xbar: number, sigma: number, n: number): NormalDist {
  return { mean: xbar, variance: (sigma * sigma) / n }
}

/** 동일꼬리 구간 (정규분포는 대칭·단봉이라 HPD와 같다, 교재 [예 9.8]) */
export function centralInterval(d: NormalDist, level: number): Interval {
  const h = normPpf(1 - (1 - level) / 2) * Math.sqrt(d.variance)
  return { lower: d.mean - h, upper: d.mean + h }
}

/** 신용구간의 사후질량 (검산용) */
export function massOf(d: NormalDist, iv: Interval): number {
  const sd = Math.sqrt(d.variance)
  return normCdf((iv.upper - d.mean) / sd) - normCdf((iv.lower - d.mean) / sd)
}

/** 사후 평균의 축소 가중치 w: m_n = w·x̄ + (1 − w)·m₀ */
export function shrinkWeight(sigma: number, n: number, prior: Prior): number {
  if (prior.kind === 'flat') return 1
  return posterior(0, sigma, n, prior).variance * (n / (sigma * sigma))
}

/** 신용구간 C_B(x̄) = m_n(x̄) ± q√v_n */
export function credibleInterval(xbar: number, sigma: number, n: number, level: number, prior: Prior): Interval {
  return centralInterval(posterior(xbar, sigma, n, prior), level)
}

/**
 * 고정된 참값 μ에서 신용구간의 반복표집 포함률 (정확).
 * D = w·X̄ + (1−w)·m₀ − μ ~ N((1−w)(m₀ − μ), w²·SE²), 포함 ⟺ |D| ≤ h = q√v_n
 */
export function credibleCoverage(mu: number, sigma: number, n: number, level: number, prior: Prior): number {
  const se = sigma / Math.sqrt(n)
  const w = shrinkWeight(sigma, n, prior)
  const vn = posterior(0, sigma, n, prior).variance
  const h = normPpf(1 - (1 - level) / 2) * Math.sqrt(vn)
  const delta = prior.kind === 'flat' ? 0 : (1 - w) * (prior.m0 - mu)
  const s = w * se
  return normCdf((h - delta) / s) - normCdf((-h - delta) / s)
}

/** 사후(또는 피듀셜) 표본 [from, to). 반복표집 스트림과 다른 스트림을 쓴다 */
export const POSTERIOR_STREAM = 0x706f7374 // 'post'

export function drawFrom(d: NormalDist, seed: number, from: number, to: number): Float64Array {
  const out = new Float64Array(Math.max(0, to - from))
  const sd = Math.sqrt(d.variance)
  for (let j = 0; j < out.length; j++) {
    const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, POSTERIOR_STREAM), from + j))
    out[j] = d.mean + sd * rng.normal()
  }
  return out
}
