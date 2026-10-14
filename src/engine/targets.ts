// E08 추정 대상이 다른 구간 (PRD v2 §7 E08): 정규 모집단, 모평균 신뢰구간 대 새 관측값 하나의 예측구간.
// 새 관측값 Y_b는 반복 b의 표본과 다른 스트림에서 뽑는다 (표본 자체는 E01과 같다).
import { Rng, deriveSeed } from './core/rng'
import { normCdf } from './core/normal'
import { criticalValue, type Interval, type Method } from './meanInterval'

/** 예측구간 x̄ ± q·sd·√(1 + 1/n). z는 σ, t는 S를 쓴다 (정규·독립 표본) */
export function predictionInterval(method: Method, xbar: number, sd: number, n: number, level: number): Interval {
  const h = criticalValue(method, level, n, 'two') * sd * Math.sqrt(1 + 1 / n)
  return { lower: xbar - h, upper: xbar + h }
}

/** 구간이 덮는 모집단 질량 P(L ≤ Y ≤ U), Y ~ N(μ, σ²) */
export function populationMass(iv: Interval, mu: number, sigma: number): number {
  return normCdf((iv.upper - mu) / sigma) - normCdf((iv.lower - mu) / sigma)
}

/** σ를 아는 z 신뢰구간이 새 관측값을 포함할 확률 (절차 전체): 2Φ(q/√(n+1)) − 1 */
export function ciCoversNewObs(level: number, n: number): number {
  const q = criticalValue('z', level, n, 'two')
  return 2 * normCdf(q / Math.sqrt(n + 1)) - 1
}

export const NEXT_STREAM = 0x6e657874 // 'next'

/** 반복 b의 새 관측값 Y_b ~ N(μ, σ²) */
export function newObservation(seed: number, b: number, mu: number, sigma: number): number {
  const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, NEXT_STREAM), b))
  return mu + sigma * rng.normal()
}
