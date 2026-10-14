// E03 피벗량으로 구간 만들기 (PRD v2 §7 E03): z·t (P0), χ²·F (P1).
// 꼬리 배분: 피벗 분포의 왼쪽 꼬리 α_L, 오른쪽 꼬리 α_U, α_L + α_U = α.
// P(Q_{α_L} ≤ 피벗 ≤ Q_{1−α_U}) = 1 − α를 모수에 대한 부등식으로 풀어 구간을 얻는다.
import { normCdf, normPdf, normPpf } from './core/normal'
import { incBeta, lgamma } from './core/special'
import { tCdf, tPdf, tPpf } from './core/tdist'
import type { Interval } from './meanInterval'

/* ---------------- χ²·F 분포 ---------------- */

function gammaPSeries(a: number, x: number): number {
  let sum = 1 / a
  let term = sum
  for (let n = 1; n < 1000; n++) {
    term *= x / (a + n)
    sum += term
    if (Math.abs(term) < Math.abs(sum) * 1e-16) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
}

/** 상측 불완전감마 연분수 (수정 Lentz). 검정 실험실(hypothesis-lab)의 chisq.ts에서 가져옴 */
function gammaQCF(a: number, x: number): number {
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h
}

/** 정규화 하측 불완전감마 P(a, x) */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0
  return x < a + 1 ? gammaPSeries(a, x) : 1 - gammaQCF(a, x)
}

export function chi2Cdf(x: number, k: number): number {
  return gammaP(k / 2, x / 2)
}

export function chi2Pdf(x: number, k: number): number {
  if (x <= 0) return 0
  return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2))
}

export function fCdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  return incBeta(d1 / 2, d2 / 2, (d1 * x) / (d1 * x + d2))
}

export function fPdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  const lb = lgamma(d1 / 2) + lgamma(d2 / 2) - lgamma((d1 + d2) / 2)
  return Math.exp((d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x) - ((d1 + d2) / 2) * Math.log1p((d1 * x) / d2) - lb)
}

/** 증가하는 CDF의 역함수 (양의 지지집합, 로그 척도 이분법) */
function ppfPositive(cdf: (x: number) => number, q: number): number {
  if (q <= 0) return 0
  if (q >= 1) return Infinity
  let lo = 1e-300
  let hi = 1
  while (cdf(hi) < q) hi *= 2
  while (cdf(lo * 1e10) < q && lo * 1e10 < hi) lo *= 1e10
  for (let i = 0; i < 300; i++) {
    const mid = Math.sqrt(lo * hi)
    if (cdf(mid) < q) lo = mid
    else hi = mid
    if (hi / lo - 1 < 1e-15) break
  }
  return Math.sqrt(lo * hi)
}

export const chi2Ppf = (q: number, k: number) => ppfPositive((x) => chi2Cdf(x, k), q)
export const fPpf = (q: number, d1: number, d2: number) => ppfPositive((x) => fCdf(x, d1, d2), q)

/* ---------------- 피벗 ---------------- */

export type PivotKind = 'z' | 't' | 'chi2' | 'f'

export interface PivotObs {
  xbar: number
  /** z에서 쓰는 알려진 σ */
  sigma: number
  /** 표본표준편차 S (t·χ²·F의 첫 표본) */
  s: number
  n: number
  /** F의 둘째 표본 */
  s2: number
  n2: number
}

export interface PivotDist {
  cdf: (x: number) => number
  pdf: (x: number) => number
  ppf: (q: number) => number
  /** 그림에 쓸 범위 */
  domain: [number, number]
  symmetric: boolean
  name: string
}

export function pivotDist(kind: PivotKind, o: PivotObs): PivotDist {
  switch (kind) {
    case 'z':
      return { cdf: normCdf, pdf: normPdf, ppf: (q) => (q <= 0 ? -Infinity : q >= 1 ? Infinity : normPpf(q)), domain: [-4, 4], symmetric: true, name: 'N(0, 1)' }
    case 't': {
      const v = o.n - 1
      const w = Math.max(4, tPpf(0.995, v) * 1.1)
      return { cdf: (x) => tCdf(x, v), pdf: (x) => tPdf(x, v), ppf: (q) => (q <= 0 ? -Infinity : q >= 1 ? Infinity : tPpf(q, v)), domain: [-Math.min(w, 12), Math.min(w, 12)], symmetric: true, name: `t(${v})` }
    }
    case 'chi2': {
      const k = o.n - 1
      return { cdf: (x) => chi2Cdf(x, k), pdf: (x) => chi2Pdf(x, k), ppf: (q) => chi2Ppf(q, k), domain: [0, chi2Ppf(0.999, k)], symmetric: false, name: `χ²(${k})` }
    }
    case 'f': {
      const d1 = o.n - 1
      const d2 = o.n2 - 1
      return { cdf: (x) => fCdf(x, d1, d2), pdf: (x) => fPdf(x, d1, d2), ppf: (q) => fPpf(q, d1, d2), domain: [0, Math.min(fPpf(0.995, d1, d2), 30)], symmetric: false, name: `F(${d1}, ${d2})` }
    }
  }
}

/** 피벗을 뒤집은 구간. aL·aU = 피벗 분포의 왼쪽·오른쪽 꼬리 */
export function pivotInterval(kind: PivotKind, o: PivotObs, aL: number, aU: number): Interval {
  const d = pivotDist(kind, o)
  const qL = d.ppf(aL)
  const qU = d.ppf(1 - aU)
  switch (kind) {
    case 'z':
    case 't': {
      // Z = (X̄ − μ)/SE: 양변에 −SE를 곱하면 부등호 방향이 바뀐다
      const se = (kind === 'z' ? o.sigma : o.s) / Math.sqrt(o.n)
      return { lower: o.xbar - qU * se, upper: o.xbar - qL * se }
    }
    case 'chi2': {
      // W = (n−1)S²/σ²: 역수를 취하면 부등호 방향이 바뀐다 → σ²의 구간
      const ss = (o.n - 1) * o.s * o.s
      return { lower: ss / qU, upper: qL > 0 ? ss / qL : Infinity }
    }
    case 'f': {
      // F = (S₁²/S₂²)/ρ, ρ = σ₁²/σ₂²
      const r = (o.s * o.s) / (o.s2 * o.s2)
      return { lower: r / qU, upper: qL > 0 ? r / qL : Infinity }
    }
  }
}

/** 꼬리 배분 share = α_L/α (0이면 오른쪽 꼬리만, 1이면 왼쪽 꼬리만) */
export function splitTails(alpha: number, share: number): { aL: number; aU: number } {
  return { aL: alpha * share, aU: alpha * (1 - share) }
}

/** 꼬리 배분에 따른 구간 길이를 최소로 하는 share (황금분할 탐색, 양끝 제외) */
export function shortestShare(kind: PivotKind, o: PivotObs, alpha: number): number {
  const len = (sh: number) => {
    const { aL, aU } = splitTails(alpha, sh)
    const iv = pivotInterval(kind, o, aL, aU)
    return iv.upper - iv.lower
  }
  let a = 1e-6
  let b = 1 - 1e-6
  const g = (Math.sqrt(5) - 1) / 2
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  for (let i = 0; i < 200 && b - a > 1e-12; i++) {
    if (len(c) < len(d)) b = d
    else a = c
    c = b - g * (b - a)
    d = a + g * (b - a)
  }
  return (a + b) / 2
}
