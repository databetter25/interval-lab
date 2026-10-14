// E10 정확성 (PRD v2 AC-E10-1·2, §9 G18·G19)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { criticalValue } from '../../src/engine/meanInterval'
import { expectedLength, falseCoverage, integrateFalseCoverage, powerAt } from '../../src/engine/accuracy'
import { summarize } from '../../src/engine/repeat'

const g = golden.E10

describe('오포함확률과 검정력', () => {
  it('AC-E10-1: P_100{90 ∈ C} = 0.4839947', () => {
    expect(Math.abs(falseCoverage(100, 90, 5, 0.025, 0.025) - g.G18.value)).toBeLessThan(1e-7)
  })
  it('오포함확률 = 1 − 검정력 (따로 계산), 꼬리 배분·단측 모두', () => {
    for (const [aL, aU] of [[0.025, 0.025], [0.01, 0.04], [0, 0.05], [0.05, 0]]) {
      for (const tp of [70, 90, 99, 100, 101, 113, 140]) expect(Math.abs(falseCoverage(100, tp, 5, aL, aU) + powerAt(100, tp, 5, aL, aU) - 1)).toBeLessThan(1e-12)
    }
  })
  it('θ′ = θ에서 오포함확률 = 포함률 1 − α', () => {
    expect(Math.abs(falseCoverage(100, 100, 5, 0.01, 0.04) - 0.95)).toBeLessThan(1e-12)
  })
  it('단측 하한 구간', () => {
    for (const r of g.oneSided) expect(Math.abs(falseCoverage(r.theta, r.thetaPrime, r.se, 0, 0.05) - r.value)).toBeLessThan(1e-12)
  })
  it('AC-E10-2: Pratt — 곡선 아래 넓이 = 기대 길이 19.5996398', () => {
    expect(Math.abs(integrateFalseCoverage(100, 5, 0.025, 0.025) - g.G19.value)).toBeLessThan(1e-5)
    expect(Math.abs(expectedLength(5, 0.025, 0.025) - g.G19.value)).toBeLessThan(1e-9)
    expect(Math.abs(integrateFalseCoverage(100, 5, 0.01, 0.04) - expectedLength(5, 0.01, 0.04))).toBeLessThan(1e-5)
  })
})

describe('t 구간의 오포함확률 (σ 미지): MC가 비중심 t와 맞는다', () => {
  for (const n of [5, 25]) {
    it(`n = ${n}`, () => {
      const B = 40_000
      const sum = summarize({ mu: 100, sigma: 25, n, seed: 12 }, 0, B)
      const q = criticalValue('t', 0.95, n, 'two')
      for (const r of g.tFalseCov.filter((x) => x.n === n)) {
        let k = 0
        for (let b = 0; b < B; b++) {
          const h = (q * sum.s[b]) / Math.sqrt(n)
          if (sum.xbar[b] - h <= r.thetaPrime && r.thetaPrime <= sum.xbar[b] + h) k++
        }
        expect(Math.abs(k / B - r.value), `θ′ = ${r.thetaPrime}`).toBeLessThan(4 * Math.sqrt((r.value * (1 - r.value)) / B) + 1e-4)
      }
    })
  }
})
