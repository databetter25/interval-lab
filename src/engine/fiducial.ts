// E15 일반화 피듀셜 (PRD v2 P2): 로그정규 평균 θ = exp(μ + σ²/2)의 일반화 피벗량(GPQ) 구간.
// Y = exp(X), X ~ N(μ, σ²). 관측 x̄, s²(로그 척도)를 고정하고 Z ~ N(0,1), U ~ χ²_{n−1}을 다시 뽑아
//   G_μ = x̄ − Z·s·√((n−1)/U)/√n,  G_{σ²} = (n−1)s²/U,  G = G_μ + G_{σ²}/2
// G의 분포는 θ에 의존하지 않고(피벗), 관측값을 넣으면 log θ와 같아진다. 그 분위수가 구간이다.
// 피셔의 고전적 피듀셜 논증과 구분되는 현대적 ‘일반화 피듀셜’(Weerahandi 1993; Krishnamoorthy & Mathew 2003).
import { Rng, deriveSeed } from './core/rng'
import { normPpf } from './core/normal'
import { tPpf } from './core/tdist'
import { quantileSorted } from './bootstrap'
import type { Interval } from './meanInterval'

export const FID_DATA = 0x66646174 // 'fdat'
export const FID_GPQ = 0x66677071 // 'fgpq'

/** 감마(shape, 1) 표본: Marsaglia–Tsang. shape < 1이면 U^{1/shape} 부스트 */
export function gammaDraw(rng: Rng, shape: number): number {
  if (shape < 1) return gammaDraw(rng, shape + 1) * Math.pow(1 - rng.next(), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = rng.normal()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = 1 - rng.next()
    if (u < 1 - 0.0331 * x ** 4) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

export const chi2Draw = (rng: Rng, k: number) => 2 * gammaDraw(rng, k / 2)

export interface LogSummary {
  n: number
  /** 로그 척도 평균·분산 */
  xbar: number
  s2: number
  /** 원 척도 평균·표준편차 */
  ybar: number
  sy: number
}

export function lognormalSample(n: number, mu: number, sigma: number, seed: number, sampleId: number): Float64Array {
  const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, FID_DATA), sampleId))
  return Float64Array.from({ length: n }, () => Math.exp(mu + sigma * rng.normal()))
}

export function summarize(y: ArrayLike<number>): LogSummary {
  const n = y.length
  let xbar = 0
  let ybar = 0
  for (let i = 0; i < n; i++) {
    xbar += Math.log(y[i])
    ybar += y[i]
  }
  xbar /= n
  ybar /= n
  let s2 = 0
  let sy2 = 0
  for (let i = 0; i < n; i++) {
    s2 += (Math.log(y[i]) - xbar) ** 2
    sy2 += (y[i] - ybar) ** 2
  }
  return { n, xbar, s2: s2 / (n - 1), ybar, sy: Math.sqrt(sy2 / (n - 1)) }
}

/** 주어진 Z, U 뽑기에서 G = log θ의 일반화 피벗량 값들 (정렬하지 않음) */
export function gpqFromDraws(xbar: number, s2: number, n: number, z: ArrayLike<number>, u: ArrayLike<number>): Float64Array {
  const s = Math.sqrt(s2)
  return Float64Array.from({ length: z.length }, (_, i) => xbar - (z[i] * s * Math.sqrt((n - 1) / u[i])) / Math.sqrt(n) + ((n - 1) * s2) / u[i] / 2)
}

/** GPQ 값 M개 (log θ 척도, 오름차순) */
export function gpqDraws(sm: LogSummary, M: number, seed: number, sampleId: number): Float64Array {
  const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, FID_GPQ), sampleId))
  const z = new Float64Array(M)
  const u = new Float64Array(M)
  for (let i = 0; i < M; i++) {
    z[i] = rng.normal()
    u[i] = chi2Draw(rng, sm.n - 1)
  }
  return gpqFromDraws(sm.xbar, sm.s2, sm.n, z, u).sort()
}

export type FidMethod = 'gpq' | 'cox' | 'tRaw' | 'logT'

export const FID_METHODS: { id: FidMethod; label: string; short: string; color: string; dash?: string }[] = [
  { id: 'gpq', label: '일반화 피듀셜 (GPQ)', short: 'GPQ', color: '#176b30' },
  { id: 'cox', label: 'Cox 근사 (로그 척도 정규근사)', short: 'Cox', color: '#0066cc', dash: '6 3' },
  { id: 'tRaw', label: '원 척도 t 구간', short: '원 척도 t', color: '#c2410c', dash: '2 3' },
  { id: 'logT', label: 'exp(로그 t 구간) — 중앙값 e^μ용', short: 'exp(로그 t)', color: '#7c3aed', dash: '8 2 2 2' },
]

/** 네 구간 (원 척도 θ에 대한 구간). sorted는 gpqDraws의 결과 */
export function fidIntervals(sm: LogSummary, sorted: ArrayLike<number>, level: number): Record<FidMethod, Interval> {
  const a = 1 - level
  const { n, xbar, s2, ybar, sy } = sm
  const z = normPpf(1 - a / 2)
  const t = tPpf(1 - a / 2, n - 1)
  const coxC = xbar + s2 / 2
  const coxH = z * Math.sqrt(s2 / n + (s2 * s2) / (2 * (n - 1)))
  const lh = (t * Math.sqrt(s2)) / Math.sqrt(n)
  return {
    gpq: { lower: Math.exp(quantileSorted(sorted, a / 2)), upper: Math.exp(quantileSorted(sorted, 1 - a / 2)) },
    cox: { lower: Math.exp(coxC - coxH), upper: Math.exp(coxC + coxH) },
    tRaw: { lower: ybar - (t * sy) / Math.sqrt(n), upper: ybar + (t * sy) / Math.sqrt(n) },
    logT: { lower: Math.exp(xbar - lh), upper: Math.exp(xbar + lh) },
  }
}

export interface FidCoverage {
  R: number
  covered: Record<FidMethod, number>
  missLeft: Record<FidMethod, number>
  missRight: Record<FidMethod, number>
  meanLength: Record<FidMethod, number>
}

/** 표본 R개 × GPQ M개 → 네 방법의 포함률 (Worker에서 쓴다) */
export function fidCoverage(n: number, mu: number, sigma: number, M: number, R: number, level: number, seed: number): FidCoverage {
  const truth = Math.exp(mu + (sigma * sigma) / 2)
  const zero = () => ({ gpq: 0, cox: 0, tRaw: 0, logT: 0 })
  const out: FidCoverage = { R, covered: zero(), missLeft: zero(), missRight: zero(), meanLength: zero() }
  for (let r = 0; r < R; r++) {
    const id = 1_000_000 + r // 화면의 표본 번호와 겹치지 않게
    const sm = summarize(lognormalSample(n, mu, sigma, seed, id))
    const iv = fidIntervals(sm, gpqDraws(sm, M, seed, id), level)
    for (const m of FID_METHODS) {
      const c = iv[m.id]
      out.meanLength[m.id] += (c.upper - c.lower) / R
      if (c.lower > truth) out.missLeft[m.id]++
      else if (c.upper < truth) out.missRight[m.id]++
      else out.covered[m.id]++
    }
  }
  return out
}
