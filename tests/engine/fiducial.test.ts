// E15 일반화 피듀셜: 같은 표본·같은 Z, U에서 Python 독립 구현과 일치, 포함률은 numpy MC와 일치
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { chi2Draw, fidCoverage, fidIntervals, gpqDraws, gpqFromDraws, lognormalSample, summarize, type FidMethod } from '../../src/engine/fiducial'
import { Rng } from '../../src/engine/core/rng'

const g = golden.Fid
const METHODS: FidMethod[] = ['gpq', 'cox', 'tRaw', 'logT']

describe('일반화 피듀셜 구간', () => {
  it('같은 Z, U에서 GPQ·Cox·t 구간이 Python과 일치', () => {
    const sm = summarize(g.y)
    const G = gpqFromDraws(sm.xbar, sm.s2, sm.n, g.z, g.u).sort()
    const iv = fidIntervals(sm, G, 0.95)
    for (const m of METHODS) {
      const [lo, hi] = g[m] as number[]
      expect(Math.abs(iv[m].lower - lo) / Math.abs(lo), `${m} lower`).toBeLessThan(1e-10)
      expect(Math.abs(iv[m].upper - hi) / Math.abs(hi), `${m} upper`).toBeLessThan(1e-10)
    }
  })
  it('χ² 표본의 평균과 분산', () => {
    for (const k of [2, 4, 11, 99]) {
      const rng = new Rng(k)
      const N = 40000
      const v = Float64Array.from({ length: N }, () => chi2Draw(rng, k))
      const m = v.reduce((a, x) => a + x, 0) / N
      const s2 = v.reduce((a, x) => a + (x - m) ** 2, 0) / (N - 1)
      expect(Math.abs(m - k)).toBeLessThan(4 * Math.sqrt((2 * k) / N))
      expect(Math.abs(s2 / (2 * k) - 1)).toBeLessThan(0.06)
    }
  })
  it('GPQ 뽑기는 재현된다', () => {
    const sm = summarize(lognormalSample(15, 0, 1, 3, 0))
    expect([...gpqDraws(sm, 500, 3, 0)]).toEqual([...gpqDraws(sm, 500, 3, 0)])
  })
  it('포함률: numpy MC와 일치 (n = 10, σ = 1)', () => {
    const c = golden.FidCov
    const R = 3000
    const r = fidCoverage(c.n, c.mu, c.sigma, 1000, R, 0.95, 2024)
    for (const m of METHODS) {
      const p = c[m] as number
      const se = Math.sqrt((p * (1 - p)) / R + (p * (1 - p)) / c.R)
      expect(Math.abs(r.covered[m] / R - p), m).toBeLessThan(4 * se + 0.005)
    }
    // GPQ는 명목수준 근처, 원 척도 t는 크게 밑돈다
    expect(r.covered.gpq / R).toBeGreaterThan(0.93)
    expect(r.covered.tRaw / R).toBeLessThan(0.88)
  }, 60000)
})
