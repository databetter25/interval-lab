// E10 정확성: 검정력과 길이 (PRD v2 §7 E10, CB 9.3.1–9.3.2).
// 정규평균, σ 알려짐. 구간 C(X) = [X̄ − Q_{1−α_U}·SE, X̄ − Q_{α_L}·SE] (E03과 같은 꼬리 배분)
import { normCdf, normPpf } from './core/normal'

function quantiles(aL: number, aU: number) {
  return { qL: aL <= 0 ? -Infinity : normPpf(aL), qU: aU <= 0 ? Infinity : normPpf(1 - aU) }
}

/** 오포함확률 P_θ{θ′ ∈ C(X)}: θ′ ∈ C ⟺ θ′ + Q_{α_L}·SE ≤ X̄ ≤ θ′ + Q_{1−α_U}·SE */
export function falseCoverage(theta: number, thetaPrime: number, se: number, aL: number, aU: number): number {
  const { qL, qU } = quantiles(aL, aU)
  const d = (thetaPrime - theta) / se
  return normCdf(d + qU) - normCdf(d + qL)
}

/**
 * H₀: θ = θ′ 검정(같은 꼬리 배분: Q_{α_L} ≤ (X̄ − θ′)/SE ≤ Q_{1−α_U}이면 기각하지 않음)의 참값 θ에서의 검정력.
 * 오포함확률과 따로 계산해 1 − 검정력 = 오포함확률임을 확인한다.
 */
export function powerAt(theta: number, thetaPrime: number, se: number, aL: number, aU: number): number {
  const { qL, qU } = quantiles(aL, aU)
  const shift = (theta - thetaPrime) / se // (X̄ − θ′)/SE ~ N(shift, 1)
  const below = normCdf(qL - shift)
  const above = 1 - normCdf(qU - shift)
  return below + above
}

/** 기대 길이 (Q_{1−α_U} − Q_{α_L})·SE */
export function expectedLength(se: number, aL: number, aU: number): number {
  const { qL, qU } = quantiles(aL, aU)
  return (qU - qL) * se
}

/** Pratt 항등식의 좌변: ∫ P_θ{θ′ ∈ C} dθ′ (심프슨, ±halfWidth) */
export function integrateFalseCoverage(theta: number, se: number, aL: number, aU: number, halfWidth = 14 * se, N = 4000): number {
  const a = theta - halfWidth
  const h = (2 * halfWidth) / N
  let sum = falseCoverage(theta, a, se, aL, aU) + falseCoverage(theta, a + 2 * halfWidth, se, aL, aU)
  for (let i = 1; i < N; i++) sum += (i % 2 ? 4 : 2) * falseCoverage(theta, a + i * h, se, aL, aU)
  return (sum * h) / 3
}

/* ---------------- 손실함수 관점 (CB 9.3.4, P2) ---------------- */
// 구간 x̄ ± c·SE에 손실 L = b·길이 − 1{θ ∈ C}를 매기면 위험은 R(c) = 2bc·SE − (2Φ(c) − 1).
// R′(c) = 2b·SE − 2φ(c) = 0 ⟹ φ(c*) = b·SE. b·SE·√(2π) ≥ 1이면 c* = 0 (구간을 만들지 않는 편이 낫다)

export function lossRisk(c: number, b: number, se: number): number {
  return 2 * b * c * se - (2 * normCdf(c) - 1)
}

export function optimalHalfWidth(b: number, se: number): number {
  const t = b * se * Math.sqrt(2 * Math.PI)
  return t >= 1 ? 0 : Math.sqrt(-2 * Math.log(t))
}

/** 위험을 최소로 하는 구간의 포함률 = 그 손실이 ‘고른’ 신뢰수준 */
export function impliedLevel(b: number, se: number): number {
  return 2 * normCdf(optimalHalfWidth(b, se)) - 1
}

/** 신뢰수준 1 − α를 고르는 것과 같은 길이 비용 b = φ(Q_{1−α/2})/SE */
export function costForLevel(level: number, se: number): number {
  const z = normPpf(1 - (1 - level) / 2)
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) / se
}
