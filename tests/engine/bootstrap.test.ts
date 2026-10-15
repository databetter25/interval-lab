// E14 부트스트랩: 같은 표본·같은 재표집 통계량에서 Python 독립 구현과 일치, 포함률은 numpy MC와 일치
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { bootCoverage, bootIntervals, bootstrapStats, quantileSorted, statistic, trueParam, type BootStat } from '../../src/engine/bootstrap'
import { popData } from '../../src/engine/robust'

const g = golden.Boot

describe('부트스트랩 구간 공식', () => {
  for (const c of g.cases) {
    it(`${c.kind}: percentile·basic·BCa, z₀, a`, () => {
      const r = bootIntervals(c.kind as BootStat, g.x, c.boot, 0.95)
      const tol = 1e-9 * Math.max(1, Math.abs(c.theta))
      expect(Math.abs(r.theta - c.theta)).toBeLessThan(tol)
      for (const m of ['percentile', 'basic', 'bca'] as const) {
        expect(Math.abs(r[m].lower - c[m][0]), `${m} lower`).toBeLessThan(tol * 10)
        expect(Math.abs(r[m].upper - c[m][1]), `${m} upper`).toBeLessThan(tol * 10)
      }
      expect(Math.abs(r.z0 - c.z0)).toBeLessThan(1e-9)
      expect(Math.abs(r.a - c.a)).toBeLessThan(1e-9)
    })
  }
  it('선형 보간 분위수', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantileSorted([1, 2, 3, 4], 0)).toBe(1)
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4)
  })
  it('재표집은 재현되고 관측값 근처에 모인다', () => {
    const x = popData({ pop: 'exp', mu: 0, sigma: 1, n: 30, seed: 5 }, 0)
    const a = bootstrapStats('mean', x, 2000, 5, 0)
    expect([...a]).toEqual([...bootstrapStats('mean', x, 2000, 5, 0)])
    const mean = a.reduce((p, v) => p + v, 0) / a.length
    expect(Math.abs(mean - statistic('mean', x))).toBeLessThan(0.02)
  })
  it('참값: 평균·분산을 맞춘 모집단의 중앙값', () => {
    expect(trueParam('median', 'exp', 0, 1)).toBeCloseTo(Math.LN2 - 1, 12)
    expect(trueParam('median', 'normal', 5, 2)).toBe(5)
    expect(trueParam('var', 'lnorm', 0, 3)).toBe(9)
  })
})

describe('포함률 (지수 모집단의 평균, n = 20)', () => {
  it('numpy MC(R = 4,000, B = 1,000)와 맞는다: 세 방법 모두 95%에 못 미친다', { timeout: 60_000 }, () => {
    const R = 1500
    const c = bootCoverage('mean', 'exp', 0, 1, 20, 1000, R, 0.95, 21)
    for (const m of ['percentile', 'basic', 'bca'] as const) {
      const ref = g.covExpMean20[m]
      const tol = 4 * Math.sqrt((ref * (1 - ref)) / R + (ref * (1 - ref)) / g.covExpMean20.R)
      expect(Math.abs(c.covered[m] / R - ref), m).toBeLessThan(tol)
      expect(c.covered[m] / R).toBeLessThan(0.94)
    }
  })
})
