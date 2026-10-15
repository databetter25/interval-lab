// E11 두 모집단: SciPy 기준값, 대응 설계의 SE, pooled t의 붕괴(시뮬레이션)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { indInterval, pairedInterval, propDiffCoverage, propDiffNewcombe, propDiffWald, sePaired, twoData, twoSummaries, type IndMethod } from '../../src/engine/twoSample'

const g = golden.E11

describe('E11 기준값', () => {
  it('독립 두 평균: pooled·Welch·대표본 z', () => {
    for (const r of g.ind) {
      const iv = indInterval(r.m as IndMethod, { x1: r.x1, s1: r.s1, n1: r.n1, x2: r.x2, s2: r.s2, n2: r.n2 }, 0.95)
      expect(Math.abs(iv.lower - r.lower), JSON.stringify(r)).toBeLessThan(1e-7)
      expect(Math.abs(iv.upper - r.upper), JSON.stringify(r)).toBeLessThan(1e-7)
      if (r.df !== null) expect(Math.abs(iv.df - r.df)).toBeLessThan(1e-9)
    }
  })
  it('대응 t', () => {
    const r = g.paired[0]
    const iv = pairedInterval(r.dbar, r.sd, r.n, 0.95)
    expect(Math.abs(iv.lower - r.lower)).toBeLessThan(1e-9)
  })
  it('두 비율의 차 Wald 구간과 정확 포함률', () => {
    const r = g.propIv[0]
    const iv = propDiffWald(r.x1, r.n1, r.x2, r.n2, 0.95)
    expect(Math.abs(iv.lower - r.lower)).toBeLessThan(1e-12)
    for (const c of g.propCov) expect(Math.abs(propDiffCoverage(c.p1, c.n1, c.p2, c.n2, 0.95).coverage - c.value)).toBeLessThan(1e-9)
  })
})

describe('설계와 시뮬레이션', () => {
  it('대응 자료의 상관이 ρ이고, 차이의 SE가 공식과 맞는다', () => {
    const spec = { mu1: 0, mu2: 0, sigma1: 2, sigma2: 3, n1: 200_000, n2: 200_000, rho: 0.7, paired: true, seed: 2 }
    const { x, y } = twoData(spec, 0)
    const mx = x.reduce((a, v) => a + v, 0) / x.length
    const my = y.reduce((a, v) => a + v, 0) / y.length
    let sxy = 0
    let sxx = 0
    let syy = 0
    for (let i = 0; i < x.length; i++) {
      sxy += (x[i] - mx) * (y[i] - my)
      sxx += (x[i] - mx) ** 2
      syy += (y[i] - my) ** 2
    }
    expect(Math.abs(sxy / Math.sqrt(sxx * syy) - 0.7)).toBeLessThan(0.01)
    expect(sePaired(2, 3, 0.7, 1)).toBeCloseTo(Math.sqrt(4 + 9 - 2 * 0.7 * 6), 12)
  })

  it('등분산이 깨지고 작은 표본의 분산이 크면 pooled t가 무너지고 Welch는 버틴다', () => {
    const B = 30_000
    const spec = { mu1: 100, mu2: 100, sigma1: 10, sigma2: 30, n1: 25, n2: 8, rho: 0, paired: false, seed: 4 }
    const sum = twoSummaries(spec, 0, B)
    const cov = (m: IndMethod) => {
      let k = 0
      for (let b = 0; b < B; b++) {
        const iv = indInterval(m, { x1: sum.x1[b], s1: sum.s1[b], n1: 25, x2: sum.x2[b], s2: sum.s2[b], n2: 8 }, 0.95)
        if (iv.lower <= 0 && 0 <= iv.upper) k++
      }
      return k / B
    }
    expect(cov('pooled')).toBeLessThan(0.85)
    expect(Math.abs(cov('welch') - 0.95)).toBeLessThan(0.012)
  })

  it('대응 t는 대응 자료에서 1 − α', () => {
    const B = 30_000
    const sum = twoSummaries({ mu1: 5, mu2: 3, sigma1: 2, sigma2: 3, n1: 12, n2: 12, rho: 0.8, paired: true, seed: 8 }, 0, B)
    let k = 0
    for (let b = 0; b < B; b++) {
      const iv = pairedInterval(sum.x1[b] - sum.x2[b], sum.sd[b], 12, 0.95)
      if (iv.lower <= 2 && 2 <= iv.upper) k++
    }
    expect(Math.abs(k / B - 0.95)).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / B))
  })
})

describe('P2: Newcombe hybrid score 구간', () => {
  it('Newcombe (1998) 예: 56/70 − 48/80 → [0.0524, 0.3339]', () => {
    const iv = propDiffNewcombe(56, 70, 48, 80, 0.95)
    expect(iv.lower).toBeCloseTo(0.0524, 4)
    expect(iv.upper).toBeCloseTo(0.3339, 4)
  })
  it('SciPy 기준값과 정확 포함률', () => {
    for (const r of golden.Newcombe.iv) {
      const iv = propDiffNewcombe(r.x1, r.n1, r.x2, r.n2, 0.95)
      expect(Math.abs(iv.lower - r.lower)).toBeLessThan(1e-12)
      expect(Math.abs(iv.upper - r.upper)).toBeLessThan(1e-12)
    }
    for (const c of golden.Newcombe.cov) expect(Math.abs(propDiffCoverage(c.p1, c.n1, c.p2, c.n2, 0.95, 'newcombe').coverage - c.value)).toBeLessThan(1e-9)
  })
})
