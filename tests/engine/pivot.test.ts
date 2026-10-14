// E03 피벗 엔진 (PRD v2 AC-E03-1·2·3, §9 G04·G05)
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { tPpf } from '../../src/engine/core/tdist'
import { chi2Cdf, chi2Ppf, fCdf, fPpf, pivotInterval, shortestShare, splitTails, type PivotKind } from '../../src/engine/pivot'
import { summarize } from '../../src/engine/repeat'

const g = golden.E03
const O = g.obs

describe('분위수', () => {
  it('AC-E03-1: Q_0.975(t_24) = 2.0638986', () => {
    expect(Math.abs(tPpf(0.975, 24) - 2.0638986)).toBeLessThan(1e-7)
  })
  it('χ² 분위수', () => {
    for (const r of g.chi2q) expect(Math.abs(chi2Ppf(r.q, r.k) - r.value) / r.value).toBeLessThan(1e-10)
  })
  it('F 분위수', () => {
    for (const r of g.fq) expect(Math.abs(fPpf(r.q, r.d1, r.d2) - r.value) / r.value).toBeLessThan(1e-9)
  })
  it('CDF(Q_q) = q', () => {
    for (const q of [0.001, 0.3, 0.975]) {
      expect(Math.abs(chi2Cdf(chi2Ppf(q, 7), 7) - q)).toBeLessThan(1e-12)
      expect(Math.abs(fCdf(fPpf(q, 4, 9), 4, 9) - q)).toBeLessThan(1e-12)
    }
  })
})

describe('피벗을 뒤집은 구간', () => {
  it('AC-E03-2 포함: 네 피벗, 다섯 가지 꼬리 배분', () => {
    for (const r of g.iv) {
      const iv = pivotInterval(r.kind as PivotKind, O, r.aL, r.aU)
      const ok = (a: number, b: number | null) => (b === null || !Number.isFinite(b) ? !Number.isFinite(a) : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)))
      expect(ok(iv.lower, r.lower), JSON.stringify(r)).toBe(true)
      expect(ok(iv.upper, r.upper), JSON.stringify(r)).toBe(true)
    }
  })

  it('AC-E03-3: 대칭 단봉(z·t)에서는 등꼬리가 가장 짧고, χ²·F는 그렇지 않다', () => {
    for (const r of g.shortest) {
      const sh = shortestShare(r.kind as PivotKind, O, 0.05)
      expect(Math.abs(sh - r.share), r.kind).toBeLessThan(1e-5)
    }
    expect(Math.abs(shortestShare('z', O, 0.05) - 0.5)).toBeLessThan(1e-6)
    expect(shortestShare('chi2', O, 0.05)).toBeGreaterThan(0.9)
  })

  // 반복마다 χ² 분위수를 이분법으로 다시 구하므로 느리다
  it('모든 꼬리 배분에서 포함률 = 1 − α (χ² 시뮬레이션)', { timeout: 30_000 }, () => {
    const B = 20_000
    const sigma = 3
    const sum = summarize({ mu: 0, sigma, n: 10, seed: 6 }, 0, B)
    for (const share of [0.5, 0.2, 0.96]) {
      const { aL, aU } = splitTails(0.05, share)
      let cov = 0
      for (let b = 0; b < B; b++) {
        const iv = pivotInterval('chi2', { ...O, s: sum.s[b], n: 10 }, aL, aU)
        if (iv.lower <= sigma * sigma && sigma * sigma <= iv.upper) cov++
      }
      expect(Math.abs(cov / B - 0.95), `share ${share}`).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / B))
    }
  })
})
