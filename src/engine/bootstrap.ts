// E14 부트스트랩 구간 (PRD v2 P2): 백분위수(percentile), basic, BCa.
// 재표집분포(관측 표본 하나에서 다시 뽑은 통계량들)는 표본분포(모집단에서 새 표본을 뽑은 통계량들)와 다르다:
// 중심이 참값 θ가 아니라 관측값 θ̂ 근처에 있다. 퍼짐만 표본분포를 흉내 낸다.
import { Rng, deriveSeed } from './core/rng'
import { normCdf, normPpf } from './core/normal'
import type { Interval } from './meanInterval'
import { LNORM_SHAPE, popData, type Population } from './robust'

export type BootStat = 'mean' | 'median' | 'var'

export function statistic(kind: BootStat, x: ArrayLike<number>): number {
  const n = x.length
  if (kind === 'mean') {
    let s = 0
    for (let i = 0; i < n; i++) s += x[i]
    return s / n
  }
  if (kind === 'median') {
    const a = Array.from(x).sort((p, q) => p - q)
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
  }
  let m = 0
  for (let i = 0; i < n; i++) m += x[i]
  m /= n
  let ss = 0
  for (let i = 0; i < n; i++) ss += (x[i] - m) ** 2
  return ss / (n - 1)
}

/** 모집단의 참값 (평균 μ, 중앙값, 분산 σ²) — 평균·분산을 맞춘 E09 모집단 */
export function trueParam(kind: BootStat, pop: Population, mu: number, sigma: number): number {
  if (kind === 'mean') return mu
  if (kind === 'var') return sigma * sigma
  switch (pop) {
    case 'normal':
    case 't3':
      return mu
    case 'exp':
      return mu + sigma * (Math.LN2 - 1)
    case 'lnorm': {
      const m = Math.exp(LNORM_SHAPE ** 2 / 2)
      const sd = Math.sqrt((Math.exp(LNORM_SHAPE ** 2) - 1) * Math.exp(LNORM_SHAPE ** 2))
      return mu + (sigma * (1 - m)) / sd
    }
  }
}

/** 하측 분위수 (선형 보간, numpy 기본 방식과 같음). sorted는 오름차순 */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const B = sorted.length
  const h = (B - 1) * Math.min(1, Math.max(0, q))
  const lo = Math.floor(h)
  const hi = Math.min(B - 1, lo + 1)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

export const BOOT_STREAM = 0x626f6f74 // 'boot'

/** 표본 x에서 B번 재표집한 통계량 (정렬해서 돌려준다) */
export function bootstrapStats(kind: BootStat, x: ArrayLike<number>, B: number, seed: number, sampleId: number): Float64Array {
  const n = x.length
  const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, BOOT_STREAM), sampleId))
  const out = new Float64Array(B)
  const buf = new Float64Array(n)
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) buf[i] = x[Math.floor(rng.next() * n)]
    out[b] = statistic(kind, buf)
  }
  return out.sort()
}

export interface BootIntervals {
  theta: number
  percentile: Interval
  basic: Interval
  bca: Interval
  /** BCa의 편향 보정 z₀와 가속 a */
  z0: number
  a: number
}

/** 관측 표본 x와 정렬된 재표집 통계량에서 세 구간 */
export function bootIntervals(kind: BootStat, x: ArrayLike<number>, sorted: ArrayLike<number>, level: number): BootIntervals {
  const alpha = 1 - level
  const theta = statistic(kind, x)
  const B = sorted.length
  const qlo = quantileSorted(sorted, alpha / 2)
  const qhi = quantileSorted(sorted, 1 - alpha / 2)
  // z₀ = Φ⁻¹(θ̂*가 θ̂보다 작은 비율)
  let below = 0
  for (let b = 0; b < B; b++) if (sorted[b] < theta) below++
  const z0 = normPpf(Math.min(1 - 1e-12, Math.max(1e-12, below / B)))
  // 가속 a: 잭나이프
  const n = x.length
  const jack = new Float64Array(n)
  const tmp = new Float64Array(n - 1)
  for (let i = 0; i < n; i++) {
    let k = 0
    for (let j = 0; j < n; j++) if (j !== i) tmp[k++] = x[j]
    jack[i] = statistic(kind, tmp)
  }
  let jm = 0
  for (const v of jack) jm += v
  jm /= n
  let num = 0
  let den = 0
  for (const v of jack) {
    num += (jm - v) ** 3
    den += (jm - v) ** 2
  }
  const a = den > 0 ? num / (6 * den ** 1.5) : 0
  const adj = (zq: number) => normCdf(z0 + (z0 + zq) / (1 - a * (z0 + zq)))
  const a1 = adj(normPpf(alpha / 2))
  const a2 = adj(normPpf(1 - alpha / 2))
  return {
    theta,
    percentile: { lower: qlo, upper: qhi },
    basic: { lower: 2 * theta - qhi, upper: 2 * theta - qlo },
    bca: { lower: quantileSorted(sorted, a1), upper: quantileSorted(sorted, a2) },
    z0,
    a,
  }
}

export type BootMethod = 'percentile' | 'basic' | 'bca'

export const BOOT_METHODS: { id: BootMethod; label: string; color: string; dash?: string }[] = [
  { id: 'percentile', label: '백분위수 (percentile)', color: '#0066cc' },
  { id: 'basic', label: 'basic (피벗형)', color: '#c2410c', dash: '6 3' },
  { id: 'bca', label: 'BCa (편향·가속 보정)', color: '#176b30', dash: '2 3' },
]

export interface BootCoverage {
  R: number
  covered: Record<BootMethod, number>
  missLeft: Record<BootMethod, number>
  missRight: Record<BootMethod, number>
  meanLength: Record<BootMethod, number>
}

/** 표본 R개 각각에서 부트스트랩 B회 → 세 방법의 포함률 (Worker에서 쓴다) */
export function bootCoverage(kind: BootStat, pop: Population, mu: number, sigma: number, n: number, B: number, R: number, level: number, seed: number): BootCoverage {
  const truth = trueParam(kind, pop, mu, sigma)
  const zero = () => ({ percentile: 0, basic: 0, bca: 0 })
  const out: BootCoverage = { R, covered: zero(), missLeft: zero(), missRight: zero(), meanLength: zero() }
  for (let r = 0; r < R; r++) {
    // 화면의 표본(0, 1, 2, …)과 겹치지 않도록 큰 번호부터 쓴다
    const id = 1_000_000 + r
    const x = popData({ pop, mu, sigma, n, seed }, id)
    const iv = bootIntervals(kind, x, bootstrapStats(kind, x, B, seed, id), level)
    for (const m of BOOT_METHODS) {
      const c = iv[m.id]
      out.meanLength[m.id] += (c.upper - c.lower) / R
      if (c.lower > truth) out.missLeft[m.id]++
      else if (c.upper < truth) out.missRight[m.id]++
      else out.covered[m.id]++
    }
  }
  return out
}
