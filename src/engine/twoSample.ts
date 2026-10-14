// E11 두 모집단 (PRD v2 §7 E11): 독립 두 평균(pooled·Welch·대표본 z), 대응 표본(쌍별 차이 t), 두 모비율의 차(Wald).
// 대상은 언제나 차이 δ = μ₁ − μ₂ (또는 p₁ − p₂).
import { Rng, deriveSeed } from './core/rng'
import { normPpf } from './core/normal'
import { tPpf } from './core/tdist'
import type { Interval } from './meanInterval'
import { pmfRow } from './binomCompare'

export interface TwoSummary {
  x1: number
  s1: number
  n1: number
  x2: number
  s2: number
  n2: number
}

export type IndMethod = 'pooled' | 'welch' | 'zlarge'

export const IND_METHODS: { id: IndMethod; label: string; note: string; color: string; dash?: string }[] = [
  { id: 'pooled', label: '합동 t (등분산 가정)', note: 'S_p² = ((n₁−1)S₁² + (n₂−1)S₂²)/(n₁+n₂−2), 자유도 n₁+n₂−2', color: '#c2410c' },
  { id: 'welch', label: 'Welch t', note: 'SE = √(S₁²/n₁ + S₂²/n₂), Satterthwaite 자유도', color: '#0066cc', dash: '6 3' },
  { id: 'zlarge', label: '대표본 z (교재 8.4.2)', note: 'SE = √(S₁²/n₁ + S₂²/n₂), z 분위수', color: '#176b30', dash: '2 3' },
]

export function welchDf(t: TwoSummary): number {
  const v1 = (t.s1 * t.s1) / t.n1
  const v2 = (t.s2 * t.s2) / t.n2
  return (v1 + v2) ** 2 / ((v1 * v1) / (t.n1 - 1) + (v2 * v2) / (t.n2 - 1))
}

export function indInterval(m: IndMethod, t: TwoSummary, level: number): Interval & { se: number; df: number } {
  const a = 1 - level
  const d = t.x1 - t.x2
  if (m === 'pooled') {
    const df = t.n1 + t.n2 - 2
    const sp = Math.sqrt(((t.n1 - 1) * t.s1 * t.s1 + (t.n2 - 1) * t.s2 * t.s2) / df)
    const se = sp * Math.sqrt(1 / t.n1 + 1 / t.n2)
    const q = tPpf(1 - a / 2, df)
    return { lower: d - q * se, upper: d + q * se, se, df }
  }
  const se = Math.sqrt((t.s1 * t.s1) / t.n1 + (t.s2 * t.s2) / t.n2)
  if (m === 'welch') {
    const df = welchDf(t)
    const q = tPpf(1 - a / 2, df)
    return { lower: d - q * se, upper: d + q * se, se, df }
  }
  const q = normPpf(1 - a / 2)
  return { lower: d - q * se, upper: d + q * se, se, df: Infinity }
}

/** 쌍별 차이의 t 구간 */
export function pairedInterval(dbar: number, sd: number, n: number, level: number): Interval & { se: number } {
  const se = sd / Math.sqrt(n)
  const q = tPpf(1 - (1 - level) / 2, n - 1)
  return { lower: dbar - q * se, upper: dbar + q * se, se }
}

/** 차이의 표준오차: 독립 √(σ₁²/n₁ + σ₂²/n₂), 대응 √((σ₁² + σ₂² − 2ρσ₁σ₂)/n) */
export function seIndependent(s1: number, n1: number, s2: number, n2: number): number {
  return Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2)
}
export function sePaired(s1: number, s2: number, rho: number, n: number): number {
  return Math.sqrt((s1 * s1 + s2 * s2 - 2 * rho * s1 * s2) / n)
}

/* ---------------- 반복표집 ---------------- */

export interface TwoSpec {
  mu1: number
  mu2: number
  sigma1: number
  sigma2: number
  n1: number
  /** 대응 설계에서는 n₂ = n₁ */
  n2: number
  /** 대응 설계의 쌍 내 상관 (독립이면 무시) */
  rho: number
  paired: boolean
  seed: number
}

const STREAM_IND = 0x74776f69 // 'twoi'
const STREAM_PAIR = 0x74776f70 // 'twop'

function stats(xs: number[]): { mean: number; sd: number } {
  let mean = 0
  let m2 = 0
  for (let i = 0; i < xs.length; i++) {
    const d = xs[i] - mean
    mean += d / (i + 1)
    m2 += d * (xs[i] - mean)
  }
  return { mean, sd: Math.sqrt(m2 / (xs.length - 1)) }
}

/** 반복 b의 원자료 (대응이면 같은 길이의 쌍) */
export function twoData(spec: TwoSpec, b: number): { x: number[]; y: number[] } {
  const rng = new Rng(deriveSeed(deriveSeed(spec.seed >>> 0, spec.paired ? STREAM_PAIR : STREAM_IND), b))
  const x: number[] = []
  const y: number[] = []
  if (spec.paired) {
    const r = Math.sqrt(1 - spec.rho * spec.rho)
    for (let i = 0; i < spec.n1; i++) {
      const z1 = rng.normal()
      const z2 = rng.normal()
      x.push(spec.mu1 + spec.sigma1 * z1)
      y.push(spec.mu2 + spec.sigma2 * (spec.rho * z1 + r * z2))
    }
  } else {
    for (let i = 0; i < spec.n1; i++) x.push(spec.mu1 + spec.sigma1 * rng.normal())
    for (let i = 0; i < spec.n2; i++) y.push(spec.mu2 + spec.sigma2 * rng.normal())
  }
  return { x, y }
}

export interface TwoRep {
  x1: Float64Array
  s1: Float64Array
  x2: Float64Array
  s2: Float64Array
  /** 대응: 쌍별 차이의 표준편차 */
  sd: Float64Array
}

export function twoSummaries(spec: TwoSpec, from: number, to: number): TwoRep {
  const m = Math.max(0, to - from)
  const out: TwoRep = { x1: new Float64Array(m), s1: new Float64Array(m), x2: new Float64Array(m), s2: new Float64Array(m), sd: new Float64Array(m) }
  for (let j = 0; j < m; j++) {
    const { x, y } = twoData(spec, from + j)
    const a = stats(x)
    const c = stats(y)
    out.x1[j] = a.mean
    out.s1[j] = a.sd
    out.x2[j] = c.mean
    out.s2[j] = c.sd
    out.sd[j] = spec.paired ? stats(x.map((v, i) => v - y[i])).sd : NaN
  }
  return out
}

/* ---------------- 두 모비율의 차 (Wald, 교재 8.6.2) ---------------- */

export function propDiffWald(x1: number, n1: number, x2: number, n2: number, level: number): Interval {
  const p1 = x1 / n1
  const p2 = x2 / n2
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2)
  const q = normPpf(1 - (1 - level) / 2)
  return { lower: p1 - p2 - q * se, upper: p1 - p2 + q * se }
}

/** Wald 차이 구간의 정확 포함률 (이중 전수 합) */
export function propDiffCoverage(p1: number, n1: number, p2: number, n2: number, level: number): { coverage: number; missLeft: number; missRight: number } {
  const f1 = pmfRow(n1, p1)
  const f2 = pmfRow(n2, p2)
  const d = p1 - p2
  let cov = 0
  let ml = 0
  let mr = 0
  for (let a = 0; a <= n1; a++) {
    for (let b = 0; b <= n2; b++) {
      const w = f1[a] * f2[b]
      const iv = propDiffWald(a, n1, b, n2, level)
      if (iv.lower > d) ml += w
      else if (iv.upper < d) mr += w
      else cov += w
    }
  }
  return { coverage: cov, missLeft: ml, missRight: mr }
}
