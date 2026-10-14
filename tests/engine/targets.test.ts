// E08 엔진 (PRD v2 AC-E08-1·2, §9 G17)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { meanInterval } from '../../src/engine/meanInterval'
import { summarize } from '../../src/engine/repeat'
import { ciCoversNewObs, newObservation, populationMass, predictionInterval } from '../../src/engine/targets'

const g = golden.E08

describe('예측구간 기준값', () => {
  it('AC-E08-1: z 예측구간 [50.0305270, 149.9694730]', () => {
    const iv = predictionInterval('z', 100, 25, 25, 0.95)
    expect(Math.abs(iv.lower - g.pi.lower)).toBeLessThan(1e-9)
    expect(Math.abs(iv.upper - g.pi.upper)).toBeLessThan(1e-9)
  })
  it('t 예측구간', () => {
    const iv = predictionInterval('t', 100, 20, 25, 0.95)
    expect(Math.abs(iv.lower - g.piT.lower)).toBeLessThan(1e-7)
  })
  it('신뢰구간이 새 관측값을 포함할 확률', () => {
    for (const c of g.ciCoversY) expect(Math.abs(ciCoversNewObs(c.level, c.n) - c.value)).toBeLessThan(1e-10)
  })
  it('모집단 질량: 예측구간이 β = 95% 이상을 덮는 x̄의 범위', () => {
    const m = g.piMassAtLeast
    const at = (d: number) => populationMass(predictionInterval('z', d * 25, 25, 25, 0.95), 0, 25)
    expect(Math.abs(at(0) - m.maxMass)).toBeLessThan(1e-12)
    expect(Math.abs(at(m.dstar) - 0.95)).toBeLessThan(1e-9)
  })
})

describe('반복표집 (AC-E08-2)', () => {
  const B = 100_000
  const spec = { mu: 100, sigma: 25, n: 25, seed: 17 }
  const sum = summarize(spec, 0, B)
  const tol = (c: number) => 4 * Math.sqrt((c * (1 - c)) / B)

  it('z·t 예측구간이 새 관측값을 1 − α로 포함하고, 신뢰구간은 약 30%만 포함한다', () => {
    let pz = 0
    let pt = 0
    let cz = 0
    let massGe = 0
    for (let b = 0; b < B; b++) {
      const y = newObservation(spec.seed, b, spec.mu, spec.sigma)
      const piz = predictionInterval('z', sum.xbar[b], 25, 25, 0.95)
      const pit = predictionInterval('t', sum.xbar[b], sum.s[b], 25, 0.95)
      const ci = meanInterval('z', sum.xbar[b], 25, 25, 0.95)
      if (piz.lower <= y && y <= piz.upper) pz++
      if (pit.lower <= y && y <= pit.upper) pt++
      if (ci.lower <= y && y <= ci.upper) cz++
      if (populationMass(piz, spec.mu, spec.sigma) >= 0.95) massGe++
    }
    expect(Math.abs(pz / B - 0.95)).toBeLessThan(tol(0.95))
    expect(Math.abs(pt / B - 0.95)).toBeLessThan(tol(0.95))
    const c = ciCoversNewObs(0.95, 25)
    expect(Math.abs(cz / B - c)).toBeLessThan(tol(c))
    const pm = g.piMassAtLeast.prob
    expect(Math.abs(massGe / B - pm)).toBeLessThan(tol(pm))
  })

  it('새 관측값은 재현되고 표본과 독립인 스트림이다', () => {
    expect(newObservation(5, 3, 0, 1)).toBe(newObservation(5, 3, 0, 1))
    expect(newObservation(5, 3, 0, 1)).not.toBe(newObservation(5, 4, 0, 1))
  })
})
