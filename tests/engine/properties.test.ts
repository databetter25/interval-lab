// PRD v2 §14.2 속성 기반 테스트: 쌍대성, 수준 단조성, 재현성.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { acceptanceRegion, contains, meanInterval, meanTest, type Alt, type Method } from '../../src/engine/meanInterval'
import { coverage, replicateData, summarize } from '../../src/engine/repeat'

const level = fc.double({ min: 0.5, max: 0.999, noNaN: true })
const alt = fc.constantFrom<Alt>('two', 'greater', 'less')
const method = fc.constantFrom<Method>('z', 't')

/** 경계에 너무 가까운 점은 부동소수 반올림이 판정을 정하므로 뺀다 */
function farFromEdges(v: number, lo: number, hi: number, scale: number) {
  const eps = 1e-9 * Math.max(1, scale)
  return Math.abs(v - lo) > eps && Math.abs(v - hi) > eps
}

describe('쌍대성: 기각하지 않음 ⟺ μ₀ ∈ C(x) (AC-E02-3, AC-E04-3)', () => {
  it('z·t, 양측·단측', () => {
    fc.assert(
      fc.property(method, alt, level, fc.double({ min: -1e3, max: 1e3, noNaN: true }), fc.double({ min: 0.01, max: 100, noNaN: true }), fc.integer({ min: 2, max: 500 }), fc.double({ min: -1e3, max: 1e3, noNaN: true }), (m, a, lv, xbar, sd, n, mu0) => {
        const iv = meanInterval(m, xbar, sd, n, lv, a)
        fc.pre(farFromEdges(mu0, iv.lower, iv.upper, Math.abs(xbar) + sd))
        const notRejected = meanTest(m, xbar, sd, n, mu0, a).p >= 1 - lv
        return notRejected === contains(iv, mu0)
      }),
      { numRuns: 10000 },
    )
  })

  it('신뢰띠: x̄ ∈ A(μ₀) ⟺ μ₀ ∈ C(x̄) (z)', () => {
    fc.assert(
      fc.property(alt, level, fc.double({ min: -1e3, max: 1e3, noNaN: true }), fc.double({ min: 0.01, max: 50, noNaN: true }), fc.double({ min: -1e3, max: 1e3, noNaN: true }), (a, lv, xbar, se, mu0) => {
        const iv = meanInterval('z', xbar, se, 1, lv, a)
        const A = acceptanceRegion(mu0, se, lv, a)
        fc.pre(farFromEdges(mu0, iv.lower, iv.upper, Math.abs(xbar) + se) && farFromEdges(xbar, A.lower, A.upper, Math.abs(mu0) + se))
        return contains(A, xbar) === contains(iv, mu0)
      }),
      { numRuns: 10000 },
    )
  })
})

describe('수준 단조성', () => {
  it('높은 수준의 구간이 낮은 수준의 구간을 포함한다', () => {
    fc.assert(
      fc.property(method, alt, level, level, fc.double({ min: -100, max: 100, noNaN: true }), fc.double({ min: 0.1, max: 10, noNaN: true }), fc.integer({ min: 2, max: 200 }), (m, a, l1, l2, xbar, sd, n) => {
        const [lo, hi] = l1 < l2 ? [l1, l2] : [l2, l1]
        const small = meanInterval(m, xbar, sd, n, lo, a)
        const big = meanInterval(m, xbar, sd, n, hi, a)
        return big.lower <= small.lower + 1e-12 && small.upper <= big.upper + 1e-12
      }),
    )
  })
})

describe('재현성 (AC-E01-1, §14.2)', () => {
  const spec = { mu: 100, sigma: 25, n: 25, seed: 20261014 }

  it('묶음을 어떻게 나눠도 같은 x̄·S', () => {
    const all = summarize(spec, 0, 500)
    const a = summarize(spec, 0, 137)
    const b = summarize(spec, 137, 500)
    expect([...a.xbar, ...b.xbar]).toEqual([...all.xbar])
    expect([...a.s, ...b.s]).toEqual([...all.s])
  })

  it('원자료를 다시 만들면 요약과 같다', () => {
    const sum = summarize(spec, 40, 41)
    const x = replicateData(spec, 40)
    const mean = x.reduce((p, v) => p + v, 0) / x.length
    expect(Math.abs(mean - sum.xbar[0])).toBeLessThan(1e-9)
  })

  it('seed가 다르면 표본이 다르다', () => {
    expect(summarize(spec, 0, 1).xbar[0]).not.toBe(summarize({ ...spec, seed: 1 }, 0, 1).xbar[0])
  })

  it('방법을 바꿔도 표본은 그대로이고 포함 판정만 다시 계산된다', () => {
    const sum = summarize(spec, 0, 200)
    const z = coverage({ method: 'z', level: 0.95, alt: 'two', sigma: 25, n: 25 }, sum, 100)
    const t = coverage({ method: 't', level: 0.95, alt: 'two', sigma: 25, n: 25 }, sum, 100)
    expect(z.count).toBe(200)
    expect(t.count).toBe(200)
    expect(z.cumulative[199]).toBe(z.covered)
  })
})
