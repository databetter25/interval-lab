// E09 엔진: 평균·분산 맞춤, 정규 스트림 공유, PRD 참고값(numpy MC)과의 일치
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { summarize } from '../../src/engine/repeat'
import { popData, popSummaries, robustStats, standardPdf, type Population, type RobustMethod } from '../../src/engine/robust'

describe('모집단 생성', () => {
  it('평균과 분산을 맞춘다 (맞춘 특성)', () => {
    for (const pop of ['normal', 'exp', 'lnorm', 't3'] as Population[]) {
      const x = popData({ pop, mu: 50, sigma: 4, n: 200_000, seed: 3 }, 0)
      const mean = x.reduce((a, v) => a + v, 0) / x.length
      const v = x.reduce((a, t) => a + (t - mean) ** 2, 0) / (x.length - 1)
      expect(Math.abs(mean - 50), pop).toBeLessThan(0.06)
      // t₃와 로그정규는 4차 적률이 커서 분산 추정이 크게 흔들린다
      expect(Math.abs(v / 16 - 1), pop).toBeLessThan(pop === 't3' ? 0.2 : pop === 'lnorm' ? 0.1 : 0.02)
    }
  })

  it('정규 모집단은 E01과 같은 표본이다', () => {
    const a = popSummaries({ pop: 'normal', mu: 100, sigma: 25, n: 25, seed: 9 }, 0, 50)
    const b = summarize({ mu: 100, sigma: 25, n: 25, seed: 9 }, 0, 50)
    expect([...a.xbar]).toEqual([...b.xbar])
  })

  it('표준화 밀도의 적분은 1', () => {
    for (const pop of ['normal', 'exp', 'lnorm', 't3'] as Population[]) {
      let s = 0
      const h = 0.0005
      for (let z = -60; z < 60; z += h) s += standardPdf(pop, z + h / 2) * h
      expect(Math.abs(s - 1), pop).toBeLessThan(pop === 't3' ? 2e-4 : 1e-4)
    }
  })
})

describe('포함률이 PRD 참고값(numpy MC, B = 400,000)과 맞는다', () => {
  const B = 60_000
  for (const r of golden.E09) {
    it(`${r.pop}, n = ${r.n}, ${r.method}`, { timeout: 30_000 }, () => {
      const sum = popSummaries({ pop: r.pop as Population, mu: 0, sigma: 1, n: r.n, seed: 77 }, 0, B)
      const st = robustStats(r.method as RobustMethod, sum, B, r.n, 0, 1, 0.95)
      const se = (p: number) => Math.sqrt((p * (1 - p)) / B + (p * (1 - p)) / r.B)
      expect(Math.abs(st.covered / B - r.coverage)).toBeLessThan(4 * se(r.coverage))
      expect(Math.abs(st.missLeft / B - r.missLeft)).toBeLessThan(4 * se(r.missLeft) + 1e-4)
      expect(Math.abs(st.missRight / B - r.missRight)).toBeLessThan(4 * se(r.missRight) + 1e-4)
    })
  }
})
