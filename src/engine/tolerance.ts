// 정규 허용구간 (PRD v2 E08 P2). 모집단의 비율 β 이상을 신뢰수준 γ로 덮는 구간 x̄ ± k·S.
// 출처: Howe (1969) 근사, 정확 양측 계수의 적분식과 단측 계수의 비중심 t 표현 (Krishnamoorthy & Mathew, 2009, 2장).
// 모든 값은 SciPy 독립 계산(tools/golden.py)과 몬테카를로로 검증한다.
import { normCdf, normPdf, normPpf } from './core/normal'
import { chi2Cdf, chi2Pdf, chi2Ppf } from './pivot'

/** 심프슨 적분 (짝수 N) */
function simpson(f: (x: number) => number, a: number, b: number, N = 2000): number {
  const h = (b - a) / N
  let s = f(a) + f(b)
  for (let i = 1; i < N; i++) s += (i % 2 ? 4 : 2) * f(a + i * h)
  return (s * h) / 3
}

/** Φ(z + r) − Φ(z − r) = β를 만족하는 r ≥ 0 (z를 중심으로 폭 2r인 구간이 표준정규 질량 β를 덮는다) */
export function contentRadius(z: number, beta: number): number {
  let lo = 0
  let hi = Math.abs(z) + 10
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (normCdf(z + mid) - normCdf(z - mid) < beta) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * 양측 구간 x̄ ± kS가 모집단의 β 이상을 덮을 확률 (정확).
 * Z = (X̄ − μ)/σ ~ N(0, 1/n), (n−1)S²/σ² ~ χ²(n−1), 덮음 ≥ β ⟺ kS/σ ≥ r(Z)
 */
export function twoSidedConfidence(k: number, n: number, beta: number): number {
  const { w, r2 } = radiusGrid(n, beta)
  let s = 0
  for (let i = 0; i < w.length; i++) s += w[i] * (1 - chi2Cdf(((n - 1) * r2[i]) / (k * k), n - 1))
  return 2 * s
}

const GRID_N = 800
let gridCache: { key: string; w: Float64Array; r2: Float64Array } | null = null

/** 심프슨 가중치 × X̄ 밀도, 그리고 r(z)². k와 무관하므로 (n, β)마다 한 번만 만든다 */
function radiusGrid(n: number, beta: number) {
  const key = `${n}|${beta}`
  if (gridCache?.key === key) return gridCache
  const sn = Math.sqrt(n)
  const upper = 9 / sn
  const h = upper / GRID_N
  const w = new Float64Array(GRID_N + 1)
  const r2 = new Float64Array(GRID_N + 1)
  for (let i = 0; i <= GRID_N; i++) {
    const z = i * h
    const c = i === 0 || i === GRID_N ? 1 : i % 2 ? 4 : 2
    w[i] = ((c * h) / 3) * sn * normPdf(z * sn)
    const r = contentRadius(z, beta)
    r2[i] = r * r
  }
  gridCache = { key, w, r2 }
  return gridCache
}

/** 정확 양측 허용계수 k (이분법, 신뢰도는 k에 대해 증가) */
export function twoSidedK(n: number, beta: number, gamma: number): number {
  let lo = 0.01
  let hi = 2
  while (twoSidedConfidence(hi, n, beta) < gamma) hi *= 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (twoSidedConfidence(mid, n, beta) < gamma) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Howe (1969) 근사: k = √((n−1)(1 + 1/n)·z²_{(1+β)/2} / χ²_{n−1}(1−γ)) */
export function howeK(n: number, beta: number, gamma: number): number {
  const z = normPpf((1 + beta) / 2)
  return Math.sqrt(((n - 1) * (1 + 1 / n) * z * z) / chi2Ppf(1 - gamma, n - 1))
}

/** 비중심 t의 CDF: P(T′ ≤ t) = ∫ Φ(t√(v/ν) − δ) f_χ²ν(v) dv */
export function nctCdf(t: number, nu: number, delta: number): number {
  const hi = nu + 30 * Math.sqrt(2 * nu) + 60
  return simpson((v) => normCdf(t * Math.sqrt(v / nu) - delta) * chi2Pdf(v, nu), 1e-12, hi, 4000)
}

/** 정확 단측 허용계수: 상한 x̄ + kS가 β 이상을 덮을 확률이 γ. k√n = 비중심 t(n−1, z_β√n)의 γ 분위수 */
export function oneSidedK(n: number, beta: number, gamma: number): number {
  const delta = normPpf(beta) * Math.sqrt(n)
  let lo = 0
  let hi = 2 * delta + 10
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (nctCdf(mid, n - 1, delta) < gamma) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2 / Math.sqrt(n)
}
