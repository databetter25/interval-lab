// PRD v2 §9 기준값 (MVP-α 범위). 값은 tools/golden.py(SciPy)가 만든다.
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { normPpf } from '../../src/engine/core/normal'
import { tPpf } from '../../src/engine/core/tdist'
import { marginOfError, meanInterval, meanTest, sampleSizeFor } from '../../src/engine/meanInterval'
import { normCdf } from '../../src/engine/core/normal'

describe('기준값 G01–G18', () => {
  it('G01 Q_0.975(N(0,1))', () => {
    expect(Math.abs(normPpf(0.975) - golden.G01.value)).toBeLessThan(1e-12)
  })

  it('G02 정규 z 구간 (AC-E02-1)', () => {
    const g = golden.G02
    const iv = meanInterval('z', g.xbar, g.sigma, g.n, g.level)
    expect(Math.abs(iv.lower - g.lower)).toBeLessThan(1e-6)
    expect(Math.abs(iv.upper - g.upper)).toBeLessThan(1e-6)
  })

  it('G03 교재 8.1 예', () => {
    const g = golden.G03
    const iv = meanInterval('z', g.xbar, g.sigma, g.n, g.level)
    expect(Math.abs(iv.lower - g.lower)).toBeLessThan(1e-9)
    expect(Math.abs(iv.upper - g.upper)).toBeLessThan(1e-9)
  })

  it('G04 Q_0.975(t_24) (AC-E03-1)', () => {
    expect(Math.abs(tPpf(0.975, 24) - golden.G04.value)).toBeLessThan(1e-7)
  })

  it('t 분위수 여러 자유도', () => {
    for (const g of golden.tq) expect(Math.abs(tPpf(g.q, g.df) - g.value)).toBeLessThan(1e-8 * Math.max(1, Math.abs(g.value)))
  })

  it('G13 z 검정 p-값 (AC-E04-1)', () => {
    const g = golden.G13
    const r = meanTest('z', g.xbar, g.sigma, g.n, g.mu0)
    expect(Math.abs(r.p - g.p)).toBeLessThan(1e-7)
    expect(r.p < 0.05).toBe(true)
  })

  it('AC-E04-2 구간 끝점에서는 p = α, 닫힌 구간이라 기각하지 않는다', () => {
    const r = meanTest('z', 100, 25, 25, 90.2001801)
    expect(Math.abs(r.p - 0.05)).toBeLessThan(1e-7)
    expect(r.p >= 0.05).toBe(true)
  })

  it('t 검정 p-값', () => {
    for (const g of golden.tp) expect(Math.abs(meanTest('t', g.xbar, g.s, g.n, g.mu0).p - g.p)).toBeLessThan(1e-9)
  })

  it('G14 오차한계, G15 표본크기 (AC-E05-1·2)', () => {
    for (const g of golden.G14) expect(Math.abs(marginOfError(g.sigma, g.n, g.level) - g.E)).toBeLessThan(1e-6)
    expect(sampleSizeFor(golden.G15.sigma, golden.G15.E, golden.G15.level)).toBe(golden.G15.n)
  })

  it('단측 한계', () => {
    const [ge, le] = golden.oneSided
    const a = meanInterval('z', ge.xbar, ge.sigma, ge.n, ge.level, 'greater')
    expect(Math.abs(a.lower - ge.lower!)).toBeLessThan(1e-9)
    expect(a.upper).toBe(Infinity)
    const b = meanInterval('z', le.xbar, le.sigma, le.n, le.level, 'less')
    expect(Math.abs(b.upper - le.upper!)).toBeLessThan(1e-9)
    expect(b.lower).toBe(-Infinity)
  })

  it('G18 오포함확률 = 1 − 검정력', () => {
    const g = golden.G18
    const q = normPpf(0.975)
    const d = (g.other - g.truth) / g.se
    expect(Math.abs(normCdf(q + d) - normCdf(-q + d) - g.value)).toBeLessThan(1e-7)
  })
})
