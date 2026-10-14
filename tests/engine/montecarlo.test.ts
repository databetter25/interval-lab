// PRD v2 §14.3 몬테카를로 테스트: 고정 seed, |ĉ − c| ≤ 4·√(c(1−c)/B).
import { describe, expect, it } from 'vitest'
import { blockCounts, binomPmf, coverage, mcSe, summarize } from '../../src/engine/repeat'

const B = 100_000

describe('포함률 (AC-E01-3)', () => {
  for (const method of ['z', 't'] as const) {
    it(`정규 ${method} 구간, B=${B}`, () => {
      const spec = { mu: 100, sigma: 25, n: method === 'z' ? 25 : 8, seed: 7 }
      const sum = summarize(spec, 0, B)
      const c = coverage({ method, level: 0.95, alt: 'two', sigma: 25, n: spec.n }, sum, 100)
      const tol = 4 * Math.sqrt((0.95 * 0.05) / B)
      expect(Math.abs(c.covered / B - 0.95)).toBeLessThan(tol)
      // 양쪽 비포함은 대칭이다
      expect(Math.abs(c.missLeft - c.missRight) / B).toBeLessThan(4 * Math.sqrt((2 * 0.025) / B))
      expect(c.covered + c.missLeft + c.missRight).toBe(B)
    })
  }

  it('단측 하한의 포함률은 1 − α, 비포함은 모두 왼쪽(L > μ)', () => {
    const sum = summarize({ mu: 0, sigma: 1, n: 10, seed: 3 }, 0, 50_000)
    const c = coverage({ method: 't', level: 0.9, alt: 'greater', sigma: 1, n: 10 }, sum, 0)
    expect(Math.abs(c.covered / 50_000 - 0.9)).toBeLessThan(4 * Math.sqrt((0.9 * 0.1) / 50_000))
    expect(c.missRight).toBe(0)
  })
})

describe('보조 함수', () => {
  it('MC 표준오차', () => {
    expect(mcSe(950, 1000)).toBeCloseTo(Math.sqrt((0.95 * 0.05) / 1000), 12)
  })
  it('묶음 포함 개수', () => {
    const covers = new Uint8Array(250).fill(1)
    covers[3] = 0
    expect(blockCounts(covers, 250)).toEqual([99, 100])
  })
  it('이항 PMF의 합은 1', () => {
    let s = 0
    for (let k = 0; k <= 100; k++) s += binomPmf(k, 100, 0.95)
    expect(Math.abs(s - 1)).toBeLessThan(1e-12)
  })
})
