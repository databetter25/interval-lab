// 표준정규분포 Φ, 1−Φ, Φ⁻¹.
// erfc: |x| < 2 이면 erf 테일러 급수, 그 밖은 연분수(수정 Lentz)로 꼬리 상대정밀도를 확보한다.
// Φ⁻¹: Acklam 유리근사 + Halley 보정 1회.

const SQRT2 = Math.SQRT2
const SQRT2PI = Math.sqrt(2 * Math.PI)
const TWO_OVER_SQRTPI = 2 / Math.sqrt(Math.PI)

function erfSeries(x: number): number {
  // erf(x) = 2/√π Σ (-1)^n x^(2n+1) / (n! (2n+1))
  let term = x
  let sum = x
  const x2 = x * x
  for (let n = 1; n < 200; n++) {
    term *= -x2 / n
    const add = term / (2 * n + 1)
    sum += add
    if (Math.abs(add) < 1e-17 * Math.abs(sum)) break
  }
  return TWO_OVER_SQRTPI * sum
}

function erfcContinuedFraction(x: number): number {
  // x > 0. erfc(x) = exp(-x²)/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + …)))))
  const tiny = 1e-300
  let f = x
  let C = x
  let D = 0
  for (let k = 1; k < 500; k++) {
    const a = k / 2
    D = x + a * D
    D = D === 0 ? tiny : D
    C = x + a / C
    C = C === 0 ? tiny : C
    D = 1 / D
    const delta = C * D
    f *= delta
    if (Math.abs(delta - 1) < 1e-16) break
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f
}

export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x < 0) return 2 - erfc(-x)
  if (x < 2) return 1 - erfSeries(x)
  return erfcContinuedFraction(x)
}

/** P(Z ≤ z) */
export function normCdf(z: number): number {
  if (z === Infinity) return 1
  if (z === -Infinity) return 0
  return 0.5 * erfc(-z / SQRT2)
}

/** P(Z > z) */
export function normSf(z: number): number {
  return normCdf(-z)
}

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT2PI
}

const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]

/** Φ⁻¹(p) */
export function normPpf(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity
    if (p === 1) return Infinity
    return NaN
  }
  const plow = 0.02425
  let x: number
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p))
    x = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1)
  } else if (p <= 1 - plow) {
    const q = p - 0.5
    const r = q * q
    x = ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1)
  }
  // Halley 보정. 위쪽 절반은 대칭 Φ⁻¹(p) = −Φ⁻¹(1−p)로 아래 꼬리에서 보정한다.
  const lower = p <= 0.5
  const q = lower ? p : 1 - p
  let y = lower ? x : -x
  for (let i = 0; i < 2; i++) {
    const e = normCdf(y) - q
    const u = e * SQRT2PI * Math.exp(0.5 * y * y)
    y = y - u / (1 + (y * u) / 2)
  }
  return lower ? y : -y
}

/** χ²₁ 상단 꼬리 P(W > w) */
export function chi2Sf1(w: number): number {
  if (w <= 0) return 1
  return 2 * normSf(Math.sqrt(w))
}

/** χ²₁ 밀도 */
export function chi2Pdf1(w: number): number {
  if (w <= 0) return 0
  return Math.exp(-w / 2) / Math.sqrt(2 * Math.PI * w)
}

/** χ²₁의 상위 α 분위수 */
export function chi2Ppf1Upper(alpha: number): number {
  const z = normPpf(1 - alpha / 2)
  return z * z
}
