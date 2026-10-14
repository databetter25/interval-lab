// E05 설계 변수 (PRD v2 §7 E05): 오차한계, 표본크기, σ를 모를 때의 t 구간 기대 길이.
import { lgamma } from './core/special'
import { criticalValue, marginOfError, sampleSizeFor } from './meanInterval'

export { marginOfError, sampleSizeFor }

/** c₄(n) = E[S]/σ = √(2/(n−1))·Γ(n/2)/Γ((n−1)/2), 정규 표본 */
export function c4(n: number): number {
  return Math.sqrt(2 / (n - 1)) * Math.exp(lgamma(n / 2) - lgamma((n - 1) / 2))
}

/** z 구간의 길이 2·Q_{1−α/2}·σ/√n */
export function zLength(sigma: number, n: number, level: number): number {
  return 2 * marginOfError(sigma, n, level)
}

/** t 구간의 기대 길이 E[2·t_{n−1}·S/√n] = 2·t·c₄·σ/√n */
export function expectedTLength(sigma: number, n: number, level: number): number {
  return (2 * criticalValue('t', level, n, 'two') * c4(n) * sigma) / Math.sqrt(n)
}

/** t 구간의 기대 반폭이 E 이하가 되는 최소 n (n ≥ 2). 계획값 σ가 필요하다 */
export function sampleSizeT(sigma: number, E: number, level: number, maxN = 1_000_000): number {
  let n = Math.max(2, sampleSizeFor(sigma, E, level))
  while (n < maxN && expectedTLength(sigma, n, level) / 2 > E) n++
  return n
}
