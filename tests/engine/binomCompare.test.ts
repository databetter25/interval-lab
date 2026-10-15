// E06 이항구간 비교 엔진 (PRD v2 AC-E06-1·2·3, §9 G06–G12)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { binomPmfExact } from '../../src/engine/binomial'
import { compareBelt, compareInterval, performanceAt, performanceCurves, pmfRow, type CompareMethod } from '../../src/engine/binomCompare'

describe('E06 기준값', () => {
  it('AC-E06-1: 방법별 끝점 (n=10·x=3 포함, 경계 x=0·n)', () => {
    for (const g of golden.cmpCI) {
      const iv = compareInterval(g.x, g.n, g.level, g.method as CompareMethod, { a: g.a, b: g.b })
      expect(Math.abs(iv.lower - g.lower), JSON.stringify(g)).toBeLessThan(1e-9)
      expect(Math.abs(iv.upper - g.upper), JSON.stringify(g)).toBeLessThan(1e-9)
    }
  })

  it('AC-E06-2: 포함률·평균 길이·좌우 비포함', () => {
    for (const g of golden.cmpPerf) {
      const r = performanceAt(compareBelt(g.n, g.level, g.method as CompareMethod, { a: g.a, b: g.b }), g.p)
      for (const k of ['coverage', 'meanLength', 'missLeft', 'missRight'] as const) expect(Math.abs(r[k] - g[k]), `${JSON.stringify(g)} ${k}`).toBeLessThan(1e-8)
    }
  })

  it('AC-E06-3: 미수정 Jeffreys, n=10, p=0.01의 포함률 = 0.99¹⁰', () => {
    const r = performanceAt(compareBelt(10, 0.95, 'jeffreys'), 0.01)
    expect(Math.abs(r.coverage - 0.99 ** 10)).toBeLessThan(1e-12)
    // x = 0일 때만 참값을 포함한다
    const belt = compareBelt(10, 0.95, 'jeffreys')
    expect(belt.map((iv) => iv.lower <= 0.01 && 0.01 <= iv.upper)).toEqual([true, ...Array(10).fill(false)])
  })

  it('경계 변형은 원래 방법과 다르다', () => {
    expect(compareInterval(0, 10, 0.95, 'jeffreys').lower).toBeGreaterThan(0)
    expect(compareInterval(0, 10, 0.95, 'jeffreys_boundary').lower).toBe(0)
    expect(compareInterval(10, 10, 0.95, 'jeffreys_boundary').upper).toBe(1)
    expect(compareInterval(1, 10, 0.95, 'wald').lower).toBeLessThan(0)
    expect(compareInterval(1, 10, 0.95, 'wald_clipped').lower).toBe(0)
  })

  it('격자 요약 (CP, n=10, 격자 999점)', () => {
    const c = performanceCurves(10, 0.95, ['cp'])['cp']
    expect(c.grid.length).toBe(999)
    expect(Math.abs(c.gridMinCoverage - golden.cmpGridCP10.min)).toBeLessThan(1e-9)
    // CP 포함률은 p ↔ 1 − p 대칭이라 최솟값이 두 점에서 같다. 어느 쪽이 잡혀도 맞다
    expect(Math.min(Math.abs(c.gridMinAt - golden.cmpGridCP10.at), Math.abs(c.gridMinAt - (1 - golden.cmpGridCP10.at)))).toBeLessThan(1e-12)
    expect(Math.abs(c.gridMeanCoverage - golden.cmpGridCP10.mean)).toBeLessThan(1e-9)
  })

  it('네 성능 확률의 합: 포함 + 좌 + 우 = 1', () => {
    for (const id of ['wald', 'cp', 'jeffreys', 'agresti_coull'] as CompareMethod[]) {
      const r = performanceAt(compareBelt(37, 0.9, id), 0.42)
      expect(Math.abs(r.coverage + r.missLeft + r.missRight - 1)).toBeLessThan(1e-12)
    }
  })
})

describe('PMF 점화식', () => {
  it('직접 계산과 같다 (n = 1000 포함)', () => {
    for (const [n, p] of [[10, 0.3], [1000, 0.004], [1000, 0.73], [1, 0.5]] as const) {
      const row = pmfRow(n, p)
      let s = 0
      for (let k = 0; k <= n; k++) {
        s += row[k]
        expect(Math.abs(row[k] - binomPmfExact(k, n, p))).toBeLessThan(1e-12)
      }
      expect(Math.abs(s - 1)).toBeLessThan(1e-10)
    }
  })

  it('AC-E06-5: n = 1000, 다섯 방법, 격자 999점이 1초 안에', () => {
    const t0 = performance.now()
    performanceCurves(1000, 0.95, ['wald', 'wilson', 'cp', 'jeffreys', 'agresti_coull'])
    // 기준은 기준 기기에서 1초. 공용 CI 러너는 느릴 수 있어 여유를 둔다
    expect(performance.now() - t0).toBeLessThan(process.env.CI ? 3000 : 1000)
  })
})

describe('P2: 가능도비 구간', () => {
  it('SciPy 근 찾기와 같다 (경계 x = 0, n 포함)', () => {
    for (const r of golden.LR) {
      const iv = compareInterval(r.x, r.n, 0.95, 'lr')
      expect(Math.abs(iv.lower - r.lower), JSON.stringify(r)).toBeLessThan(1e-9)
      expect(Math.abs(iv.upper - r.upper), JSON.stringify(r)).toBeLessThan(1e-9)
    }
  })
  it('정확 포함률', () => {
    for (const r of golden.LRcov) expect(Math.abs(performanceAt(compareBelt(r.n, 0.95, 'lr'), r.p).coverage - r.value)).toBeLessThan(1e-9)
  })
})
