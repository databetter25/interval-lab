// 이항 모비율의 검정과 그 검정을 뒤집은 구간 (PRD v2 E02 이항 신뢰띠, E06 일부).
// 세 방법은 서로 다른 검정을 뒤집는다: cp ← 정확검정(양 꼬리 각 α/2), wilson ← score 검정, wald ← Wald 검정.
// 기각 규칙은 정규 모형과 같이 "p < α이면 기각"이며, C(x) = {p₀ : p(p₀) ≥ α}는 닫힌 구간이다.
import { Rng, deriveSeed } from './core/rng'
import { normPpf, normSf } from './core/normal'
import { incBeta } from './core/special'
import type { Interval } from './meanInterval'

export type BinomMethod = 'cp' | 'wilson' | 'wald'

export const BINOM_METHODS: { id: BinomMethod; label: string; test: string; exact: boolean; scope: '교재' | '확장' }[] = [
  { id: 'cp', label: 'Clopper–Pearson', test: '이항 정확검정 (양 꼬리 각 α/2)', exact: true, scope: '확장' },
  { id: 'wilson', label: 'Wilson (score)', test: 'score 검정 z = (x − np₀)/√(np₀(1−p₀))', exact: false, scope: '확장' },
  { id: 'wald', label: 'Wald (교재 8.6.1)', test: 'Wald 검정 z = (p̂ − p₀)/√(p̂(1−p̂)/n)', exact: false, scope: '교재' },
]

/** P_p(X ≤ x) */
export function binomCdf(x: number, n: number, p: number): number {
  if (x < 0) return 0
  if (x >= n) return 1
  if (p <= 0) return 1
  if (p >= 1) return 0
  return 1 - incBeta(x + 1, n - x, p)
}

/** P_p(X ≥ x) */
export function binomSfIncl(x: number, n: number, p: number): number {
  if (x <= 0) return 1
  if (x > n) return 0
  if (p <= 0) return 0
  if (p >= 1) return 1
  return incBeta(x, n - x + 1, p)
}

export function binomPmfExact(x: number, n: number, p: number): number {
  if (x < 0 || x > n) return 0
  if (p <= 0) return x === 0 ? 1 : 0
  if (p >= 1) return x === n ? 1 : 0
  let logC = 0
  for (let i = 1; i <= x; i++) logC += Math.log((n - x + i) / i)
  return Math.exp(logC + x * Math.log(p) + (n - x) * Math.log1p(-p))
}

/** I_t(a, b) = target인 t (증가함수, 이분법) */
export function betaInv(target: number, a: number, b: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 200 && hi - lo > 1e-16; i++) {
    const mid = (lo + hi) / 2
    if (incBeta(a, b, mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** 양측 p-값 */
export function binomTestP(x: number, n: number, p0: number, method: BinomMethod): number {
  if (method === 'cp') return Math.min(1, 2 * Math.min(binomCdf(x, n, p0), binomSfIncl(x, n, p0)))
  const ph = x / n
  if (method === 'wilson') {
    const v = p0 * (1 - p0)
    if (v === 0) return x === n * p0 ? 1 : 0
    return Math.min(1, 2 * normSf(Math.abs(x - n * p0) / Math.sqrt(n * v)))
  }
  // Wald: x = 0 또는 n이면 표준오차가 0이라 p₀ = p̂일 때만 기각하지 않는다 (퇴화)
  const se = Math.sqrt((ph * (1 - ph)) / n)
  if (se === 0) return p0 === ph ? 1 : 0
  return Math.min(1, 2 * normSf(Math.abs(ph - p0) / se))
}

/** 검정을 뒤집은 구간. Wald는 [0, 1] 밖으로 나가도 잘라내지 않는다 (PRD v2 E06 경계 정책) */
export function binomInterval(x: number, n: number, level: number, method: BinomMethod): Interval {
  const a = 1 - level
  if (method === 'cp') {
    return { lower: x === 0 ? 0 : betaInv(a / 2, x, n - x + 1), upper: x === n ? 1 : betaInv(1 - a / 2, x + 1, n - x) }
  }
  const z = normPpf(1 - a / 2)
  const ph = x / n
  if (method === 'wilson') {
    const d = 1 + (z * z) / n
    const c = (ph + (z * z) / (2 * n)) / d
    const h = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / d
    return { lower: c - h, upper: c + h }
  }
  const h = z * Math.sqrt((ph * (1 - ph)) / n)
  return { lower: ph - h, upper: ph + h }
}

/** 모든 x의 구간 (신뢰띠의 가로 막대들) */
export function binomBelt(n: number, level: number, method: BinomMethod): Interval[] {
  return Array.from({ length: n + 1 }, (_, x) => binomInterval(x, n, level, method))
}

/** 채택역 A(p₀): H₀: p = p₀를 기각하지 않는 x들 */
export function binomAcceptance(n: number, p0: number, level: number, method: BinomMethod): boolean[] {
  return Array.from({ length: n + 1 }, (_, x) => binomTestP(x, n, p0, method) >= 1 - level)
}

/** 정확 포함률 c(p) = Σ 1{L(x) ≤ p ≤ U(x)} PMF(x; n, p) — 전수 합 */
export function binomCoverage(n: number, p: number, belt: Interval[]): number {
  let c = 0
  for (let x = 0; x <= n; x++) if (belt[x].lower <= p && p <= belt[x].upper) c += binomPmfExact(x, n, p)
  return c
}

/** 이항 생성 스트림. 반복 b의 x는 (seed, 스트림, b)로만 정해진다 */
export const BINOM_STREAM = 0x62696e6f // 'bino'

export function binomReplicate(seed: number, b: number, n: number, p: number): number {
  const rng = new Rng(deriveSeed(deriveSeed(seed >>> 0, BINOM_STREAM), b))
  let x = 0
  for (let i = 0; i < n; i++) if (rng.next() < p) x++
  return x
}

export function binomReplicates(seed: number, from: number, to: number, n: number, p: number): Uint16Array {
  const out = new Uint16Array(Math.max(0, to - from))
  for (let j = 0; j < out.length; j++) out[j] = binomReplicate(seed, from + j, n, p)
  return out
}
