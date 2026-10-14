// E09 가정 위반과 대표본 근사 (PRD v2 §7 E09).
// 모집단마다 표준화 확률변수 Z(평균 0, 분산 1)를 만든 뒤 X = μ + σZ로 평균·분산을 맞춘다.
// 맞추지 않은 특성(왜도·첨도)은 그대로 남는다. 정규 모집단은 E01과 같은 스트림을 써서 같은 표본을 낸다.
import { Rng, deriveSeed } from './core/rng'
import { chi2Ppf } from './pivot'
import { criticalValue, type Interval } from './meanInterval'
import { replicateSeed } from './repeat'

export type Population = 'normal' | 'exp' | 'lnorm' | 't3'

export const LNORM_SHAPE = 1 // log X ~ N(0, 1)

export interface PopMeta {
  id: Population
  label: string
  /** 왜도 */
  skew: number
  /** 초과첨도 (정규 = 0) */
  exKurt: number
}

const e = Math.exp(LNORM_SHAPE ** 2)
export const POPULATIONS: PopMeta[] = [
  { id: 'normal', label: '정규', skew: 0, exKurt: 0 },
  { id: 'exp', label: '지수', skew: 2, exKurt: 6 },
  { id: 'lnorm', label: `로그정규 (σ_log = ${LNORM_SHAPE})`, skew: (e + 2) * Math.sqrt(e - 1), exKurt: e ** 4 + 2 * e ** 3 + 3 * e ** 2 - 6 },
  { id: 't3', label: 't (자유도 3)', skew: 0, exKurt: Infinity },
]

const STREAM: Record<Population, number> = { normal: 0, exp: 0x65787031, lnorm: 0x6c6e6f72, t3: 0x74647333 }

function seedFor(pop: Population, seed: number, b: number): number {
  return pop === 'normal' ? replicateSeed(seed, b) : deriveSeed(deriveSeed(seed >>> 0, STREAM[pop]), b)
}

/** 표준화 확률변수 하나 */
function standardDraw(pop: Population, rng: Rng): number {
  switch (pop) {
    case 'normal':
      return rng.normal()
    case 'exp':
      return -Math.log(1 - rng.next()) - 1
    case 'lnorm': {
      const m = Math.exp(LNORM_SHAPE ** 2 / 2)
      const sd = Math.sqrt((Math.exp(LNORM_SHAPE ** 2) - 1) * Math.exp(LNORM_SHAPE ** 2))
      return (Math.exp(LNORM_SHAPE * rng.normal()) - m) / sd
    }
    case 't3': {
      const z = rng.normal()
      const a = rng.normal()
      const b = rng.normal()
      const c = rng.normal()
      // T = Z/√(χ²₃/3), Var T = 3
      return z / Math.sqrt((a * a + b * b + c * c) / 3) / Math.sqrt(3)
    }
  }
}

/** 표준화 밀도 (그림용). t₃는 분산 1로 줄인 밀도 */
export function standardPdf(pop: Population, z: number): number {
  switch (pop) {
    case 'normal':
      return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
    case 'exp':
      return z < -1 ? 0 : Math.exp(-(z + 1))
    case 'lnorm': {
      const m = Math.exp(LNORM_SHAPE ** 2 / 2)
      const sd = Math.sqrt((Math.exp(LNORM_SHAPE ** 2) - 1) * Math.exp(LNORM_SHAPE ** 2))
      const xv = m + sd * z
      if (xv <= 0) return 0
      const lx = Math.log(xv)
      return (sd * Math.exp((-0.5 * lx * lx) / LNORM_SHAPE ** 2)) / (xv * LNORM_SHAPE * Math.sqrt(2 * Math.PI))
    }
    case 't3': {
      const t = z * Math.sqrt(3)
      return (Math.sqrt(3) * (2 / (Math.PI * Math.sqrt(3)))) / (1 + (t * t) / 3) ** 2
    }
  }
}

export interface PopSpec {
  pop: Population
  mu: number
  sigma: number
  n: number
  seed: number
}

/** 반복 [from, to)의 x̄과 S */
export function popSummaries(spec: PopSpec, from: number, to: number): { xbar: Float64Array; s: Float64Array } {
  const m = Math.max(0, to - from)
  const xbar = new Float64Array(m)
  const s = new Float64Array(m)
  for (let j = 0; j < m; j++) {
    const rng = new Rng(seedFor(spec.pop, spec.seed, from + j))
    let mean = 0
    let m2 = 0
    for (let i = 0; i < spec.n; i++) {
      const x = spec.mu + spec.sigma * standardDraw(spec.pop, rng)
      const d = x - mean
      mean += d / (i + 1)
      m2 += d * (x - mean)
    }
    xbar[j] = mean
    s[j] = Math.sqrt(m2 / (spec.n - 1))
  }
  return { xbar, s }
}

/** 반복 b의 원자료 */
export function popData(spec: PopSpec, b: number): Float64Array {
  const rng = new Rng(seedFor(spec.pop, spec.seed, b))
  return Float64Array.from({ length: spec.n }, () => spec.mu + spec.sigma * standardDraw(spec.pop, rng))
}

/** 평균의 세 방법: z(σ 알려짐), t(정규 가정), clt(교재 8.2.2: x̄ ± z·S/√n) / 분산의 χ² 구간 */
export type RobustMethod = 'z' | 't' | 'clt' | 'chi2'

export const ROBUST_METHODS: { id: RobustMethod; label: string; target: 'mean' | 'var'; color: string; dash?: string }[] = [
  { id: 't', label: 't 구간 (정규 가정)', target: 'mean', color: '#0066cc' },
  { id: 'clt', label: '대표본 z 근사 x̄ ± z·S/√n (8.2.2)', target: 'mean', color: '#c2410c', dash: '6 3' },
  { id: 'z', label: 'z 구간 (σ 알려짐)', target: 'mean', color: '#176b30', dash: '2 3' },
  { id: 'chi2', label: 'χ² 분산 구간 (정규 가정)', target: 'var', color: '#6e40c9' },
]

export interface Quantiles {
  z: number
  t: number
  chiLo: number
  chiHi: number
}

export function quantilesFor(n: number, level: number): Quantiles {
  const a = 1 - level
  return { z: criticalValue('z', level, n, 'two'), t: criticalValue('t', level, n, 'two'), chiLo: chi2Ppf(a / 2, n - 1), chiHi: chi2Ppf(1 - a / 2, n - 1) }
}

export function robustInterval(method: RobustMethod, xbar: number, s: number, n: number, sigma: number, q: Quantiles): Interval {
  switch (method) {
    case 'z':
      return { lower: xbar - (q.z * sigma) / Math.sqrt(n), upper: xbar + (q.z * sigma) / Math.sqrt(n) }
    case 't':
      return { lower: xbar - (q.t * s) / Math.sqrt(n), upper: xbar + (q.t * s) / Math.sqrt(n) }
    case 'clt':
      return { lower: xbar - (q.z * s) / Math.sqrt(n), upper: xbar + (q.z * s) / Math.sqrt(n) }
    case 'chi2':
      return { lower: ((n - 1) * s * s) / q.chiHi, upper: ((n - 1) * s * s) / q.chiLo }
  }
}

export interface RobustStats {
  count: number
  covered: number
  missLeft: number
  missRight: number
  meanLength: number
}

/** 요약값 → 방법별 성능. 대상은 평균 μ 또는 분산 σ² */
export function robustStats(method: RobustMethod, sum: { xbar: ArrayLike<number>; s: ArrayLike<number> }, count: number, n: number, mu: number, sigma: number, level: number, q = quantilesFor(n, level)): RobustStats {
  const truth = method === 'chi2' ? sigma * sigma : mu
  let covered = 0
  let ml = 0
  let mr = 0
  let len = 0
  for (let b = 0; b < count; b++) {
    const iv = robustInterval(method, sum.xbar[b], sum.s[b], n, sigma, q)
    len += iv.upper - iv.lower
    if (iv.lower > truth) ml++
    else if (iv.upper < truth) mr++
    else covered++
  }
  return { count, covered, missLeft: ml, missRight: mr, meanLength: count ? len / count : NaN }
}

/** 표본크기별 포함률 (Worker에서 쓴다). 각 n마다 B회 */
export const COVERAGE_NS = [5, 10, 20, 30, 50, 100, 200]

export function coverageByN(pop: Population, level: number, seed: number, B: number, ns = COVERAGE_NS): { n: number; stats: Record<RobustMethod, RobustStats> }[] {
  return ns.map((n) => {
    // n마다 seed를 바꿔 서로 다른 표본을 쓴다
    const sum = popSummaries({ pop, mu: 0, sigma: 1, n, seed: deriveSeed(seed, 0x6e000000 + n) }, 0, B)
    const q = quantilesFor(n, level)
    const stats = Object.fromEntries(ROBUST_METHODS.map((m) => [m.id, robustStats(m.id, sum, B, n, 0, 1, level, q)])) as Record<RobustMethod, RobustStats>
    return { n, stats }
  })
}
