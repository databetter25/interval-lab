// 정규 허용구간: SciPy 독립 계산, 표준 표의 값, 몬테카를로
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { normCdf } from '../../src/engine/core/normal'
import { summarize } from '../../src/engine/repeat'
import { howeK, nctCdf, oneSidedK, twoSidedConfidence, twoSidedK } from '../../src/engine/tolerance'

describe('허용계수', () => {
  for (const r of golden.Tol) {
    it(`n = ${r.n}, β = ${r.beta}, γ = ${r.gamma}`, { timeout: 30_000 }, () => {
      expect(Math.abs(twoSidedK(r.n, r.beta, r.gamma) - r.k2)).toBeLessThan(2e-5)
      expect(Math.abs(howeK(r.n, r.beta, r.gamma) - r.howe)).toBeLessThan(1e-9)
      expect(Math.abs(oneSidedK(r.n, r.beta, r.gamma) - r.k1)).toBeLessThan(2e-5)
    })
  }
  it('표준 표의 값: 단측 n = 10, β = 0.90, γ = 0.95 → 2.355', () => {
    expect(oneSidedK(10, 0.9, 0.95)).toBeCloseTo(2.355, 3)
  })
  it('비중심 t: δ = 0이면 보통의 t', () => {
    expect(Math.abs(nctCdf(2.0638986, 24, 0) - 0.975)).toBeLessThan(1e-6)
  })
  it('신뢰도는 k에 대해 증가', () => {
    expect(twoSidedConfidence(2.5, 10, 0.9)).toBeLessThan(twoSidedConfidence(3, 10, 0.9))
  })
})

describe('몬테카를로: 모집단의 β 이상을 덮은 비율 ≈ γ', () => {
  it('양측 정확, 단측 (n = 10, β = 0.9, γ = 0.95)', { timeout: 30_000 }, () => {
    const B = 40_000
    const n = 10
    const sum = summarize({ mu: 0, sigma: 1, n, seed: 31 }, 0, B)
    const k2 = twoSidedK(n, 0.9, 0.95)
    const k1 = oneSidedK(n, 0.9, 0.95)
    let c2 = 0
    let c1 = 0
    for (let b = 0; b < B; b++) {
      const lo = sum.xbar[b] - k2 * sum.s[b]
      const hi = sum.xbar[b] + k2 * sum.s[b]
      if (normCdf(hi) - normCdf(lo) >= 0.9) c2++
      if (normCdf(sum.xbar[b] + k1 * sum.s[b]) >= 0.9) c1++
    }
    const tol = 4 * Math.sqrt((0.95 * 0.05) / B)
    expect(Math.abs(c2 / B - 0.95)).toBeLessThan(tol)
    expect(Math.abs(c1 / B - 0.95)).toBeLessThan(tol)
  })
})
