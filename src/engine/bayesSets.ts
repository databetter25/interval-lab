// E12 베이즈 심화 (PRD v2 §7 E12): 동일꼬리 구간과 최고사후밀도(HPD) 집합, 재매개화, 사전 민감도.
// HPD = {θ : π(θ|x) ≥ h}, 질량이 1 − α가 되는 h를 이분법으로 찾는다. 끊어진 집합은 components로 돌려준다.
import { normCdf, normPdf } from './core/normal'
import { incBeta, lgamma } from './core/special'
import { gammaP } from './pivot'
import type { Interval } from './meanInterval'

export interface Dist1D {
  name: string
  pdf: (t: number) => number
  cdf: (t: number) => number
  /** 지지집합 (그림과 탐색 범위) */
  support: [number, number]
  /** 밀도가 끝에서 무한대로 가면 그 끝을 성분 경계로 쓴다 */
  view: [number, number]
}

export function betaDist(a: number, b: number): Dist1D {
  const lb = lgamma(a) + lgamma(b) - lgamma(a + b)
  return {
    name: `Beta(${fmt(a)}, ${fmt(b)})`,
    pdf: (t) => (t <= 0 || t >= 1 ? 0 : Math.exp((a - 1) * Math.log(t) + (b - 1) * Math.log1p(-t) - lb)),
    cdf: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : incBeta(a, b, t)),
    support: [0, 1],
    view: [0, 1],
  }
}

/** Gamma(shape k, rate r) */
export function gammaDist(k: number, r: number): Dist1D {
  const d: Dist1D = {
    name: `Gamma(${fmt(k)}, ${fmt(r)})`,
    pdf: (t) => (t <= 0 ? 0 : Math.exp(k * Math.log(r) + (k - 1) * Math.log(t) - r * t - lgamma(k))),
    cdf: (t) => (t <= 0 ? 0 : gammaP(k, r * t)),
    support: [0, Infinity],
    view: [0, 1],
  }
  d.view = [0, quantile(d, 0.9995)]
  return d
}

export function normalDist(mean: number, variance: number): Dist1D {
  const sd = Math.sqrt(variance)
  return { name: `N(${fmt(mean)}, ${fmt(variance)})`, pdf: (t) => normPdf((t - mean) / sd) / sd, cdf: (t) => normCdf((t - mean) / sd), support: [-Infinity, Infinity], view: [mean - 4.5 * sd, mean + 4.5 * sd] }
}

/** 두 정규의 혼합 w·N(m₁, s₁²) + (1 − w)·N(m₂, s₂²): 다봉 사후분포의 예 */
export function mixtureDist(w: number, m1: number, s1: number, m2: number, s2: number): Dist1D {
  return {
    name: `${fmt(w)}·N(${fmt(m1)}, ${fmt(s1 * s1)}) + ${fmt(1 - w)}·N(${fmt(m2)}, ${fmt(s2 * s2)})`,
    pdf: (t) => (w * normPdf((t - m1) / s1)) / s1 + ((1 - w) * normPdf((t - m2) / s2)) / s2,
    cdf: (t) => w * normCdf((t - m1) / s1) + (1 - w) * normCdf((t - m2) / s2),
    support: [-Infinity, Infinity],
    view: [Math.min(m1 - 4.5 * s1, m2 - 4.5 * s2), Math.max(m1 + 4.5 * s1, m2 + 4.5 * s2)],
  }
}

function fmt(v: number) {
  return String(Number(v.toPrecision(5)))
}

/** 분위수 (CDF 이분법) */
export function quantile(d: Dist1D, q: number): number {
  let lo = Number.isFinite(d.support[0]) ? d.support[0] : -1
  let hi = Number.isFinite(d.support[1]) ? d.support[1] : 1
  while (!Number.isFinite(d.support[0]) && d.cdf(lo) > q) lo = lo * 2 - 1
  while (!Number.isFinite(d.support[1]) && d.cdf(hi) < q) hi = hi * 2 + 1
  for (let i = 0; i < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(hi)); i++) {
    const mid = (lo + hi) / 2
    if (d.cdf(mid) < q) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function equalTail(d: Dist1D, level: number): Interval {
  const a = 1 - level
  return { lower: quantile(d, a / 2), upper: quantile(d, 1 - a / 2) }
}

export function massOf(d: Dist1D, comps: Interval[]): number {
  return comps.reduce((s, c) => s + d.cdf(c.upper) - d.cdf(c.lower), 0)
}

/** {θ : f(θ) ≥ h}의 성분들. 격자에서 부호 변화를 찾고 이분법으로 경계를 다듬는다 */
export function superLevelSet(d: Dist1D, h: number, grid = 4000): Interval[] {
  const [a, b] = d.view
  const xs: number[] = []
  for (let i = 0; i <= grid; i++) xs.push(a + ((b - a) * i) / grid)
  // 끝점의 밀도는 무한일 수 있으므로 살짝 안쪽에서 잰다
  const inner = (b - a) * 1e-12
  const f = (t: number) => d.pdf(Math.min(b - inner, Math.max(a + inner, t)))
  const above = xs.map((x) => f(x) >= h)
  const refine = (lo: number, hi: number, loAbove: boolean) => {
    for (let i = 0; i < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(hi)); i++) {
      const mid = (lo + hi) / 2
      if (f(mid) >= h === loAbove) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const comps: Interval[] = []
  let start = above[0] ? a : NaN
  for (let i = 1; i <= grid; i++) {
    if (above[i] !== above[i - 1]) {
      const edge = refine(xs[i - 1], xs[i], above[i - 1])
      if (above[i]) start = edge
      else {
        comps.push({ lower: start, upper: edge })
        start = NaN
      }
    }
  }
  if (!Number.isNaN(start)) comps.push({ lower: start, upper: b })
  return comps
}

export interface HpdResult {
  components: Interval[]
  /** 밀도의 자르는 높이 */
  h: number
  mass: number
  length: number
}

export function hpd(d: Dist1D, level: number): HpdResult {
  // 밀도 최댓값을 격자로 어림한 뒤 h를 이분법으로 찾는다 (질량은 h에 대해 감소)
  const [a, b] = d.view
  let fmax = 0
  for (let i = 1; i < 4000; i++) fmax = Math.max(fmax, d.pdf(a + ((b - a) * i) / 4000))
  let lo = 0
  let hi = fmax
  let comps = superLevelSet(d, hi)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const c = superLevelSet(d, mid)
    if (massOf(d, c) > level) lo = mid
    else hi = mid
    if (hi - lo < 1e-14 * fmax) break
  }
  const h = (lo + hi) / 2
  comps = superLevelSet(d, h)
  return { components: comps, h, mass: massOf(d, comps), length: comps.reduce((s, c) => s + c.upper - c.lower, 0) }
}

/* ---------------- 재매개화 φ = g(θ) ---------------- */

export interface Reparam {
  name: string
  g: (t: number) => number
  ginv: (p: number) => number
  /** dθ/dφ */
  jac: (p: number) => number
}

export const LOGIT: Reparam = {
  name: 'logit θ = log(θ/(1−θ))',
  g: (t) => Math.log(t / (1 - t)),
  ginv: (p) => 1 / (1 + Math.exp(-p)),
  jac: (p) => {
    const t = 1 / (1 + Math.exp(-p))
    return t * (1 - t)
  },
}

export const LOG: Reparam = { name: 'log θ', g: (t) => Math.log(t), ginv: (p) => Math.exp(p), jac: (p) => Math.exp(p) }

/** φ = g(θ)의 분포 (g 증가함수) */
export function transformed(d: Dist1D, r: Reparam): Dist1D {
  const lo = r.g(Math.max(d.view[0], quantile(d, 1e-7)))
  const hi = r.g(Math.min(d.view[1], quantile(d, 1 - 1e-7)))
  return {
    name: `${d.name}의 ${r.name}`,
    pdf: (p) => d.pdf(r.ginv(p)) * r.jac(p),
    cdf: (p) => d.cdf(r.ginv(p)),
    support: [-Infinity, Infinity],
    view: [lo, hi],
  }
}
