// E05 설계 변수 (PRD v2 AC-E05-1·2, §9 G14·G15)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { c4, expectedTLength, marginOfError, sampleSizeFor, sampleSizeT, zLength } from '../../src/engine/design'
import { summarize } from '../../src/engine/repeat'
import { criticalValue } from '../../src/engine/meanInterval'

const g = golden.E05

describe('E05 기준값', () => {
  it('AC-E05-1: 오차한계 9.7998199 / 4.8999100, n 4배 → E 절반', () => {
    expect(Math.abs(marginOfError(25, 25, 0.95) - 9.7998199)).toBeLessThan(1e-6)
    expect(Math.abs(marginOfError(25, 100, 0.95) - 4.89991)).toBeLessThan(1e-6)
    expect(marginOfError(25, 100, 0.95) / marginOfError(25, 25, 0.95)).toBeCloseTo(0.5, 12)
    expect(marginOfError(25, 50, 0.95) / marginOfError(25, 25, 0.95)).toBeCloseTo(Math.SQRT1_2, 12)
    expect(zLength(25, 25, 0.95)).toBeCloseTo(2 * 9.7998199, 6)
  })
  it('AC-E05-2: σ=25, E=5, 95% → n = 97, 다른 조합도', () => {
    expect(sampleSizeFor(25, 5, 0.95)).toBe(97)
    for (const r of g.nZ) expect(sampleSizeFor(r.sigma, r.E, r.level)).toBe(r.value)
  })
  it('c₄와 t 구간의 기대 길이', () => {
    for (const r of g.c4) expect(Math.abs(c4(r.n) - r.value)).toBeLessThan(1e-12)
    for (const r of g.etLen) expect(Math.abs(expectedTLength(r.sigma, r.n, r.level) - r.value)).toBeLessThan(1e-7 * r.value)
  })
  it('σ를 모를 때(t)의 표본크기는 z보다 크다', () => {
    for (const r of g.nT) {
      expect(sampleSizeT(r.sigma, r.E, r.level)).toBe(r.value)
      expect(r.value).toBeGreaterThanOrEqual(sampleSizeFor(r.sigma, r.E, r.level))
    }
  })
  it('t 구간의 기대 길이는 언제나 z 구간보다 길다', () => {
    for (const n of [2, 3, 5, 10, 30, 200]) expect(expectedTLength(25, n, 0.95)).toBeGreaterThan(zLength(25, n, 0.95))
  })
  it('기대 길이 공식이 시뮬레이션과 맞는다 (n = 5)', () => {
    const B = 50_000
    const sum = summarize({ mu: 0, sigma: 25, n: 5, seed: 4 }, 0, B)
    const q = criticalValue('t', 0.95, 5, 'two')
    let tot = 0
    let sq = 0
    for (let b = 0; b < B; b++) {
      const w = (2 * q * sum.s[b]) / Math.sqrt(5)
      tot += w
      sq += w * w
    }
    const mean = tot / B
    const sd = Math.sqrt(sq / B - mean * mean)
    expect(Math.abs(mean - expectedTLength(25, 5, 0.95))).toBeLessThan((4 * sd) / Math.sqrt(B))
  })
})
