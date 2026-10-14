// Student t분포. 검정 실험실(hypothesis-lab)의 tdist.ts에서 분포 함수만 가져옴.
import { incBeta, lgamma } from './special'

/** P(T_ν > t) */
export function tSf(t: number, v: number): number {
  if (t === Infinity) return 0
  if (t === -Infinity) return 1
  const x = v / (v + t * t)
  const half = 0.5 * incBeta(v / 2, 0.5, x)
  return t >= 0 ? half : 1 - half
}

export function tCdf(t: number, v: number): number {
  return 1 - tSf(t, v)
}

export function tPdf(t: number, v: number): number {
  return Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2) - 0.5 * Math.log(v * Math.PI) - ((v + 1) / 2) * Math.log(1 + (t * t) / v))
}

/** P(T_ν > q) = p (0 < p < 0.5) */
export function tPpfUpper(p: number, v: number): number {
  let lo = 0
  let hi = 2
  while (tSf(hi, v) > p) hi *= 2
  for (let i = 0; i < 200 && hi - lo > 1e-14 * hi; i++) {
    const mid = (lo + hi) / 2
    if (tSf(mid, v) > p) lo = mid
    else hi = mid
  }
  let q = (lo + hi) / 2
  // Newton 보정은 이분법 구간 안에 머물 때만 받는다. p ≈ 0.5에서는 tSf의 반올림 오차가
  // p와의 차이보다 커서, 보정이 0을 넘어 부호가 뒤집힐 수 있다 (원본 hypothesis-lab의 결함).
  for (let i = 0; i < 2; i++) {
    const next = q + (tSf(q, v) - p) / tPdf(q, v)
    if (next >= lo && next <= hi) q = next
  }
  return q
}

/** 하측 분위수 Q_q(t_ν) */
export function tPpf(q: number, v: number): number {
  if (q === 0.5) return 0
  return q > 0.5 ? tPpfUpper(1 - q, v) : -tPpfUpper(q, v)
}
