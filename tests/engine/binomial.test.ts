// 이항 신뢰띠 엔진: 기준값(PRD v2 §9 G06·G08·G09·G11)과 쌍대성 속성
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { binomAcceptance, binomBelt, binomCoverage, binomInterval, binomPmfExact, binomReplicates, binomTestP, type BinomMethod } from '../../src/engine/binomial'
import { contains } from '../../src/engine/meanInterval'

describe('이항 기준값', () => {
  it('구간 끝점 (AC-E02-2, G06·G08·G09)', () => {
    for (const g of golden.binomCI) {
      const iv = binomInterval(g.x, g.n, g.level, g.method as BinomMethod)
      expect(Math.abs(iv.lower - g.lower), JSON.stringify(g)).toBeLessThan(1e-9)
      expect(Math.abs(iv.upper - g.upper), JSON.stringify(g)).toBeLessThan(1e-9)
    }
  })

  it('CP 경계: x = 0이면 L = 0, x = n이면 U = 1', () => {
    expect(binomInterval(0, 10, 0.95, 'cp').lower).toBe(0)
    expect(binomInterval(10, 10, 0.95, 'cp').upper).toBe(1)
  })

  it('Wald는 [0, 1] 밖으로 나가도 잘라내지 않는다', () => {
    const iv = binomInterval(1, 10, 0.95, 'wald')
    expect(iv.lower).toBeLessThan(0)
  })

  it('정확 포함률 (AC-E06-2, G11)', () => {
    for (const g of golden.binomCov) {
      const c = binomCoverage(g.n, g.p, binomBelt(g.n, g.level, g.method as BinomMethod))
      expect(Math.abs(c - g.value), JSON.stringify(g)).toBeLessThan(1e-8)
    }
  })

  it('정확검정 p-값', () => {
    for (const g of golden.binomP) expect(Math.abs(binomTestP(g.x, g.n, g.p0, 'cp') - g.p)).toBeLessThan(1e-10)
  })

  it('CP 끝점에서 정확검정의 p-값 = α (AC-E04-4)', () => {
    const iv = binomInterval(3, 10, 0.95, 'cp')
    expect(Math.abs(binomTestP(3, 10, iv.lower, 'cp') - 0.05)).toBeLessThan(1e-9)
    expect(Math.abs(binomTestP(3, 10, iv.upper, 'cp') - 0.05)).toBeLessThan(1e-9)
  })

  it('PMF의 합은 1', () => {
    let s = 0
    for (let x = 0; x <= 37; x++) s += binomPmfExact(x, 37, 0.42)
    expect(Math.abs(s - 1)).toBeLessThan(1e-12)
  })
})

describe('쌍대성: x ∈ A(p₀) ⟺ p₀ ∈ C(x) (AC-E02-3)', () => {
  const method = fc.constantFrom<BinomMethod>('cp', 'wilson', 'wald')
  it('세 방법, 무작위 (n, x, p₀, 수준)', () => {
    fc.assert(
      fc.property(method, fc.integer({ min: 1, max: 100 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0.5, max: 0.999, noNaN: true }), (m, n, u, p0, lv) => {
        const x = Math.min(n, Math.floor(u * (n + 1)))
        const iv = binomInterval(x, n, lv, m)
        // 끝점 바로 옆은 부동소수 반올림이 판정을 정하므로 뺀다
        fc.pre(Math.abs(p0 - iv.lower) > 1e-7 && Math.abs(p0 - iv.upper) > 1e-7)
        return binomAcceptance(n, p0, lv, m)[x] === contains(iv, p0)
      }),
      { numRuns: 10000 },
    )
  })
})

describe('이항 표본', () => {
  it('재현성과 평균', () => {
    const a = binomReplicates(11, 0, 4000, 10, 0.3)
    const b = binomReplicates(11, 1000, 4000, 10, 0.3)
    expect([...a.subarray(1000)]).toEqual([...b])
    const mean = a.reduce((p, v) => p + v, 0) / a.length
    expect(Math.abs(mean - 3)).toBeLessThan(4 * Math.sqrt(2.1 / 4000))
  })

  it('MC 포함률이 정확 포함률과 맞는다', () => {
    const B = 100_000
    const belt = binomBelt(10, 0.95, 'cp')
    const xs = binomReplicates(5, 0, B, 10, 0.3)
    let k = 0
    for (const x of xs) if (contains(belt[x], 0.3)) k++
    const c = binomCoverage(10, 0.3, belt)
    expect(Math.abs(k / B - c)).toBeLessThan(4 * Math.sqrt((c * (1 - c)) / B))
  })
})
