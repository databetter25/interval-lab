// E06 이항구간 비교 (PRD v2 §7 E06): 방법별 구간과 정확 성능(포함률, 평균 길이, 좌우 비포함)을 전수 합으로 계산한다.
// 경계 변형은 별도 method_id로 둔다: jeffreys_boundary, wald_clipped (PRD 경계 처리 정책).
import { betaInv, binomInterval } from './binomial'
import { normPpf } from './core/normal'
import type { Interval } from './meanInterval'

export type CompareMethod = 'wald' | 'wald_clipped' | 'wilson' | 'cp' | 'jeffreys' | 'jeffreys_boundary' | 'agresti_coull' | 'bayes_beta' | 'lr'

export interface CompareMeta {
  id: CompareMethod
  label: string
  basis: string
  /** 그래프 선: 색과 대시 (색만으로 구분하지 않는다) */
  color: string
  dash?: string
  variant?: boolean
  scope: '교재' | '확장'
}

export const COMPARE_METHODS: CompareMeta[] = [
  { id: 'wald', label: 'Wald (교재 8.6.1)', basis: 'Wald 검정 역산, 분모에 p̂. 잘라내지 않음', color: '#c2410c', scope: '교재' },
  { id: 'wilson', label: 'Wilson (score)', basis: 'score 검정 역산, 분모에 p₀', color: '#176b30', dash: '8 3', scope: '확장' },
  { id: 'cp', label: 'Clopper–Pearson', basis: '단측 정확검정 두 개(각 α/2) 역산', color: '#0066cc', scope: '확장' },
  { id: 'jeffreys', label: 'Jeffreys 동일꼬리', basis: 'Beta(1/2, 1/2) 사전의 사후 분위수 (검정 역산이 아님). 미수정', color: '#6e40c9', dash: '2 2', scope: '확장' },
  { id: 'agresti_coull', label: 'Agresti–Coull', basis: 'ñ = n + z², p̃ = (x + z²/2)/ñ를 쓴 Wald형 근사', color: '#00796b', dash: '10 3 2 3', scope: '확장' },
  { id: 'lr', label: '가능도비 (LR)', basis: '가능도비 검정 역산: 2[ℓ(p̂) − ℓ(p)] ≤ χ²₁(1−α)', color: '#b4235a', dash: '1 3', scope: '확장' },
  { id: 'bayes_beta', label: 'Beta(a, b) 사전', basis: 'Beta(a + x, b + n − x) 사후의 동일꼬리 분위수', color: '#8a5a00', dash: '4 4', scope: '확장' },
  { id: 'jeffreys_boundary', label: 'Jeffreys 경계 수정 (변형)', basis: 'jeffreys에서 x = 0이면 L = 0, x = n이면 U = 1로 바꾼 변형', color: '#6e40c9', dash: '12 4', variant: true, scope: '확장' },
  { id: 'wald_clipped', label: 'Wald 잘라냄 (변형)', basis: 'wald 구간을 [0, 1]로 잘라낸 변형', color: '#c2410c', dash: '12 4', variant: true, scope: '확장' },
]

export const DEFAULT_COMPARE: CompareMethod[] = ['wald', 'wilson', 'cp', 'jeffreys']

export interface Prior {
  a: number
  b: number
}

function betaEqualTail(a: number, b: number, level: number): Interval {
  const al = 1 - level
  return { lower: betaInv(al / 2, a, b), upper: betaInv(1 - al / 2, a, b) }
}

export function compareInterval(x: number, n: number, level: number, id: CompareMethod, prior: Prior = { a: 1, b: 1 }): Interval {
  switch (id) {
    case 'wald':
    case 'wilson':
    case 'cp':
      return binomInterval(x, n, level, id)
    case 'wald_clipped': {
      const iv = binomInterval(x, n, level, 'wald')
      return { lower: Math.max(0, iv.lower), upper: Math.min(1, iv.upper) }
    }
    case 'jeffreys':
      return betaEqualTail(x + 0.5, n - x + 0.5, level)
    case 'jeffreys_boundary': {
      const iv = betaEqualTail(x + 0.5, n - x + 0.5, level)
      return { lower: x === 0 ? 0 : iv.lower, upper: x === n ? 1 : iv.upper }
    }
    case 'bayes_beta':
      return betaEqualTail(prior.a + x, prior.b + n - x, level)
    case 'lr':
      return lrInterval(x, n, level)
    case 'agresti_coull': {
      const z = normPpf(1 - (1 - level) / 2)
      const nt = n + z * z
      const pt = (x + (z * z) / 2) / nt
      const h = z * Math.sqrt((pt * (1 - pt)) / nt)
      return { lower: pt - h, upper: pt + h }
    }
  }
}

/** 이항 로그가능도 (0·log 0 = 0) */
function loglik(x: number, n: number, p: number): number {
  const a = x === 0 ? 0 : x * Math.log(p)
  const b = n - x === 0 ? 0 : (n - x) * Math.log1p(-p)
  return a + b
}

/** 가능도비 검정을 뒤집은 구간 {p : 2[ℓ(p̂) − ℓ(p)] ≤ χ²₁(1 − α)} */
export function lrInterval(x: number, n: number, level: number): Interval {
  const z = normPpf(1 - (1 - level) / 2)
  const crit = z * z // χ²₁의 1 − α 분위수 = z²_{1−α/2}
  const ph = x / n
  const lmax = loglik(x, n, ph)
  const dev = (p: number) => 2 * (lmax - loglik(x, n, p)) - crit
  const solve = (lo: number, hi: number, incr: boolean) => {
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2
      if (dev(mid) > 0 === incr) hi = mid
      else lo = mid
    }
    return (lo + hi) / 2
  }
  // p̂에서 멀어질수록 편차가 커진다. x = 0이면 하한 0, x = n이면 상한 1
  const lower = x === 0 ? 0 : solve(0, ph, false)
  const upper = x === n ? 1 : solve(ph, 1, true)
  return { lower, upper }
}

export function compareBelt(n: number, level: number, id: CompareMethod, prior?: Prior): Interval[] {
  return Array.from({ length: n + 1 }, (_, x) => compareInterval(x, n, level, id, prior))
}

/** PMF 한 줄 (점화식, p ∈ (0, 1)) */
export function pmfRow(n: number, p: number): Float64Array {
  const out = new Float64Array(n + 1)
  if (p <= 0) {
    out[0] = 1
    return out
  }
  if (p >= 1) {
    out[n] = 1
    return out
  }
  // 로그로 시작해 언더플로를 피한다
  const lr = Math.log(p) - Math.log1p(-p)
  let lv = n * Math.log1p(-p)
  out[0] = Math.exp(lv)
  for (let k = 0; k < n; k++) {
    lv += Math.log((n - k) / (k + 1)) + lr
    out[k + 1] = Math.exp(lv)
  }
  return out
}

export interface Perf {
  coverage: number
  meanLength: number
  /** P_p{L(X) > p} */
  missLeft: number
  /** P_p{U(X) < p} */
  missRight: number
}

export function performanceAt(belt: Interval[], p: number, pmf = pmfRow(belt.length - 1, p)): Perf {
  let cov = 0
  let len = 0
  let ml = 0
  let mr = 0
  for (let x = 0; x < belt.length; x++) {
    const w = pmf[x]
    const iv = belt[x]
    len += w * (iv.upper - iv.lower)
    if (iv.lower > p) ml += w
    else if (iv.upper < p) mr += w
    else cov += w
  }
  return { coverage: cov, meanLength: len, missLeft: ml, missRight: mr }
}

/** 격자 p = 1/G, …, (G − 1)/G (기본 G = 1000 → 999점) */
export function pGrid(G = 1000): Float64Array {
  return Float64Array.from({ length: G - 1 }, (_, i) => (i + 1) / G)
}

export interface Curves {
  grid: Float64Array
  coverage: Float64Array
  meanLength: Float64Array
  missLeft: Float64Array
  missRight: Float64Array
  /** 격자 요약 */
  gridMinCoverage: number
  gridMinAt: number
  gridMeanCoverage: number
}

export function performanceCurves(n: number, level: number, ids: CompareMethod[], prior?: Prior, G = 1000): Record<string, Curves> {
  const grid = pGrid(G)
  const belts = ids.map((id) => compareBelt(n, level, id, prior))
  const out: Record<string, Curves> = {}
  const arrs = ids.map(() => ({ coverage: new Float64Array(grid.length), meanLength: new Float64Array(grid.length), missLeft: new Float64Array(grid.length), missRight: new Float64Array(grid.length) }))
  for (let i = 0; i < grid.length; i++) {
    const pmf = pmfRow(n, grid[i])
    for (let j = 0; j < ids.length; j++) {
      const r = performanceAt(belts[j], grid[i], pmf)
      arrs[j].coverage[i] = r.coverage
      arrs[j].meanLength[i] = r.meanLength
      arrs[j].missLeft[i] = r.missLeft
      arrs[j].missRight[i] = r.missRight
    }
  }
  ids.forEach((id, j) => {
    const c = arrs[j].coverage
    let min = Infinity
    let at = 0
    let sum = 0
    for (let i = 0; i < c.length; i++) {
      sum += c[i]
      if (c[i] < min) {
        min = c[i]
        at = grid[i]
      }
    }
    out[id] = { grid, ...arrs[j], gridMinCoverage: min, gridMinAt: at, gridMeanCoverage: sum / c.length }
  })
  return out
}
