// E07 세 관점 엔진 (PRD v2 AC-E07-1·2, §9 G16)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { meanInterval } from '../../src/engine/meanInterval'
import { summarize } from '../../src/engine/repeat'
import { centralInterval, credibleCoverage, credibleInterval, drawFrom, fiducial, massOf, posterior, type Prior } from '../../src/engine/threeViews'

const flat: Prior = { kind: 'flat' }

describe('세 관점의 끝점', () => {
  it('AC-E07-1: 평탄 사전이면 신뢰구간 = 신용구간 = 피듀셜 구간', () => {
    const ci = meanInterval('z', 100, 25, 25, 0.95)
    const cb = credibleInterval(100, 25, 25, 0.95, flat)
    const cf = centralInterval(fiducial(100, 25, 25), 0.95)
    for (const iv of [cb, cf]) {
      expect(Math.abs(iv.lower - ci.lower)).toBeLessThan(1e-12)
      expect(Math.abs(iv.upper - ci.upper)).toBeLessThan(1e-12)
    }
    expect(Math.abs(ci.lower - golden.G02.lower)).toBeLessThan(1e-6)
    expect(posterior(100, 25, 25, flat)).toEqual({ mean: 100, variance: 25 })
  })

  it('AC-E07-2: 사전 N(90, 10²) → 사후 N(98, 20), 신용구간', () => {
    const g = golden.E07post
    const prior: Prior = { kind: 'normal', m0: g.m0, tau0: g.tau0 }
    const post = posterior(g.xbar, g.sigma, g.n, prior)
    expect(Math.abs(post.mean - g.mean)).toBeLessThan(1e-12)
    expect(Math.abs(post.variance - g.variance)).toBeLessThan(1e-12)
    const iv = credibleInterval(g.xbar, g.sigma, g.n, 0.95, prior)
    expect(Math.abs(iv.lower - g.lower)).toBeLessThan(1e-9)
    expect(Math.abs(iv.upper - g.upper)).toBeLessThan(1e-9)
    expect(Math.abs(massOf(post, iv) - 0.95)).toBeLessThan(1e-12)
  })
})

describe('신용구간의 반복표집 포함률', () => {
  it('정확 공식이 SciPy 기준값과 같다', () => {
    for (const g of golden.E07cov) expect(Math.abs(credibleCoverage(g.mu, g.sigma, g.n, g.level, { kind: 'normal', m0: g.m0, tau0: g.tau0 }) - g.value)).toBeLessThan(1e-10)
  })

  it('평탄 사전이면 모든 μ에서 정확히 1 − α', () => {
    for (const mu of [-50, 0, 100, 1e4]) expect(Math.abs(credibleCoverage(mu, 25, 25, 0.95, flat) - 0.95)).toBeLessThan(1e-12)
  })

  it('정확 포함률이 E01 엔진의 몬테카를로와 맞는다', () => {
    const prior: Prior = { kind: 'normal', m0: 90, tau0: 5 }
    const mu = 105
    const B = 50_000
    const sum = summarize({ mu, sigma: 25, n: 25, seed: 9 }, 0, B)
    let k = 0
    for (let b = 0; b < B; b++) {
      const iv = credibleInterval(sum.xbar[b], 25, 25, 0.95, prior)
      if (iv.lower <= mu && mu <= iv.upper) k++
    }
    const c = credibleCoverage(mu, 25, 25, 0.95, prior)
    expect(c).toBeLessThan(0.9)
    expect(Math.abs(k / B - c)).toBeLessThan(4 * Math.sqrt((c * (1 - c)) / B))
  })
})

describe('사후표본', () => {
  it('재현되고, 구간 안 비율이 사후질량에 가깝다', () => {
    const post = posterior(100, 25, 25, flat)
    const a = drawFrom(post, 3, 0, 20_000)
    expect([...drawFrom(post, 3, 500, 600)]).toEqual([...a.subarray(500, 600)])
    const iv = centralInterval(post, 0.95)
    const inside = a.filter((v) => iv.lower <= v && v <= iv.upper).length / a.length
    expect(Math.abs(inside - 0.95)).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / 20_000))
  })
})
