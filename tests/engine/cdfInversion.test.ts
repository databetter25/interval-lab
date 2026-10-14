// E13 (PRD v2 수용 기준: n=5, M=0.9, 95%에서 중앙 [0.9045688, 1.8821512], 한쪽 [0.9, 1.6385078], 최단 b = 1)
import { describe, expect, it } from 'vitest'
import { aFor, bMin, cdfAt, cdfInversion, centralB, maxReplicates, shortestB, uniformInterval } from '../../src/engine/cdfInversion'

describe('균등분포 최댓값', () => {
  it('중앙 구간과 한쪽 구간', () => {
    const c = uniformInterval(0.9, 5, 0.95, centralB(5, 0.95))
    expect(Math.abs(c.lower - 0.9045688)).toBeLessThan(1e-6)
    expect(Math.abs(c.upper - 1.8821512)).toBeLessThan(1e-6)
    const o = uniformInterval(0.9, 5, 0.95, 1)
    expect(o.lower).toBe(0.9)
    expect(Math.abs(o.upper - 1.6385078)).toBeLessThan(1e-6)
  })
  it('모든 b에서 bⁿ − aⁿ = 1 − α', () => {
    for (const b of [bMin(5, 0.95) + 1e-6, 0.995, centralB(5, 0.95), 1]) expect(Math.abs(b ** 5 - aFor(b, 5, 0.95) ** 5 - 0.95)).toBeLessThan(1e-12)
  })
  it('길이를 최소로 하는 b는 1 (한쪽 구간)', () => {
    for (const n of [2, 5, 20]) expect(shortestB(n, 0.95)).toBe(1)
  })
  it('CDF 역산이 같은 구간을 준다, 끝점에서 F = α/2, 1 − α/2', () => {
    const iv = cdfInversion(0.9, 5, 0.025, 0.025)
    const c = uniformInterval(0.9, 5, 0.95, centralB(5, 0.95))
    expect(Math.abs(iv.lower - c.lower)).toBeLessThan(1e-12)
    expect(Math.abs(iv.upper - c.upper)).toBeLessThan(1e-12)
    expect(Math.abs(cdfAt(0.9, iv.upper, 5) - 0.025)).toBeLessThan(1e-12)
    expect(Math.abs(cdfAt(0.9, iv.lower, 5) - 0.975)).toBeLessThan(1e-12)
  })
  it('두 구간 모두 포함률 1 − α (시뮬레이션)', () => {
    const B = 60_000
    const ms = maxReplicates(3, 0, B, 5, 2)
    for (const b of [centralB(5, 0.95), 1]) {
      let k = 0
      for (const m of ms) {
        const iv = uniformInterval(m, 5, 0.95, b)
        if (iv.lower <= 2 && 2 <= iv.upper) k++
      }
      expect(Math.abs(k / B - 0.95)).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / B))
    }
  })
})
