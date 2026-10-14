// 반복표집 (PRD v2 E01·E02, §8.4).
// 반복 b의 표본은 (seed, 생성 모형, b)만으로 정해진다. 그래서 실행 순서·묶음 크기·Worker와 무관하게 같고,
// E01과 E02가 같은 표본 스트림을 공유하며, 선택한 반복의 원자료를 언제든 다시 만들 수 있다.
import { Rng, RNG_ID, deriveSeed } from './core/rng'
import { contains, meanInterval, type Alt, type Interval, type Method } from './meanInterval'

export const ENGINE_VERSION = 'interval-engine-0.1.0'
export { RNG_ID }
/** 정규 모집단 생성 스트림의 이름표 (난수 변환은 Box–Muller) */
export const NORMAL_STREAM = 0x6e6f726d // 'norm'
export const NORMAL_TRANSFORM = 'box-muller-v1'

export interface GenSpec {
  mu: number
  sigma: number
  n: number
  seed: number
}

export function replicateSeed(seed: number, b: number): number {
  return deriveSeed(deriveSeed(seed >>> 0, NORMAL_STREAM), b)
}

/** 반복 b의 원자료 n개 */
export function replicateData(spec: GenSpec, b: number): Float64Array {
  const rng = new Rng(replicateSeed(spec.seed, b))
  const out = new Float64Array(spec.n)
  for (let i = 0; i < spec.n; i++) out[i] = spec.mu + spec.sigma * rng.normal()
  return out
}

export interface Summaries {
  /** 첫 반복 번호 (0부터) */
  from: number
  xbar: Float64Array
  /** 표본표준편차 (n − 1로 나눔) */
  s: Float64Array
}

/** 반복 [from, to)의 x̄과 S. Welford 누적 */
export function summarize(spec: GenSpec, from: number, to: number, onProgress?: (done: number) => void, every = 2000): Summaries {
  const m = Math.max(0, to - from)
  const xbar = new Float64Array(m)
  const s = new Float64Array(m)
  for (let j = 0; j < m; j++) {
    const rng = new Rng(replicateSeed(spec.seed, from + j))
    let mean = 0
    let m2 = 0
    for (let i = 0; i < spec.n; i++) {
      const x = spec.mu + spec.sigma * rng.normal()
      const d = x - mean
      mean += d / (i + 1)
      m2 += d * (x - mean)
    }
    xbar[j] = mean
    s[j] = spec.n > 1 ? Math.sqrt(m2 / (spec.n - 1)) : NaN
    if (onProgress && (j + 1) % every === 0) onProgress(j + 1)
  }
  return { from, xbar, s }
}

export interface RepMethod {
  method: Method
  level: number
  alt: Alt
  /** z 구간에 쓰는 σ */
  sigma: number
  n: number
}

/** 반복 하나의 구간: z는 σ, t는 그 반복의 S를 쓴다 */
export function replicateInterval(rm: RepMethod, xbar: number, s: number): Interval {
  return meanInterval(rm.method, xbar, rm.method === 'z' ? rm.sigma : s, rm.n, rm.level, rm.alt)
}

export type MissSide = 'none' | 'left' | 'right'

/** left: 하한이 참값보다 크다(L > μ) / right: 상한이 참값보다 작다(U < μ) */
export function missSide(iv: Interval, truth: number): MissSide {
  if (contains(iv, truth)) return 'none'
  return iv.lower > truth ? 'left' : 'right'
}

export interface CoverageStats {
  count: number
  covered: number
  missLeft: number
  missRight: number
  meanWidth: number
  /** b번째까지의 누적 포함 수 (길이 count) */
  cumulative: Uint32Array
  covers: Uint8Array
}

/** 요약값에서 포함 통계를 계산한다 (표본은 다시 뽑지 않는다) */
export function coverage(rm: RepMethod, sum: { xbar: ArrayLike<number>; s: ArrayLike<number> }, truth: number, count = sum.xbar.length): CoverageStats {
  const cumulative = new Uint32Array(count)
  const covers = new Uint8Array(count)
  let covered = 0
  let missLeft = 0
  let missRight = 0
  let width = 0
  for (let b = 0; b < count; b++) {
    const iv = replicateInterval(rm, sum.xbar[b], sum.s[b])
    const side = missSide(iv, truth)
    if (side === 'none') {
      covered++
      covers[b] = 1
    } else if (side === 'left') missLeft++
    else missRight++
    width += iv.upper - iv.lower
    cumulative[b] = covered
  }
  return { count, covered, missLeft, missRight, meanWidth: count ? width / count : NaN, cumulative, covers }
}

/** 몬테카를로 표준오차 √(ĉ(1−ĉ)/B) */
export function mcSe(covered: number, count: number): number {
  if (count <= 0) return NaN
  const c = covered / count
  return Math.sqrt((c * (1 - c)) / count)
}

/** 100개씩 끊은 묶음마다의 포함 개수 */
export function blockCounts(covers: Uint8Array, count: number, size = 100): number[] {
  const out: number[] = []
  for (let start = 0; start + size <= count; start += size) {
    let k = 0
    for (let b = start; b < start + size; b++) k += covers[b]
    out.push(k)
  }
  return out
}

/** 이항 PMF (묶음 포함 개수의 이론 분포) */
export function binomPmf(k: number, n: number, p: number): number {
  let logC = 0
  for (let i = 1; i <= k; i++) logC += Math.log((n - k + i) / i)
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p))
}
