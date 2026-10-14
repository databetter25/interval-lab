// URL 상태와 내보내기 형식 (PRD v2 §12.3–12.4, AC-C1·C2·C3)
import { describe, expect, it } from 'vitest'
import { summarize } from '../src/engine/repeat'
import { CSV_FIELDS, binomCsv, replicatesCsv, rCode, settingsJson, stateFromSettings } from '../src/lib/exports'
import { DEFAULTS, parseState, serializeState } from '../src/state/labState'

describe('URL 상태', () => {
  it('기본값은 v만 남는다', () => {
    expect(serializeState(DEFAULTS).toString()).toBe('v=1')
  })

  it('왕복하면 같은 상태', () => {
    const s = { ...DEFAULTS, mu: 0, sigma: 1, n: 10, method: 't' as const, k: 100, seed: 42, sel: 7, hide: true, alt: 'less' as const }
    expect(parseState(serializeState(s))).toEqual(s)
  })

  it('잘못된 값은 기본값으로 되돌린다 (A09)', () => {
    const s = parseState(new URLSearchParams('n=1&level=2&method=x&k=-3&seed=abc&sigma=0&show=5000&stage=9'))
    expect(s.n).toBe(DEFAULTS.n)
    expect(s.level).toBe(DEFAULTS.level)
    expect(s.method).toBe(DEFAULTS.method)
    expect(s.k).toBe(DEFAULTS.k)
    expect(s.seed).toBe(DEFAULTS.seed)
    expect(s.sigma).toBe(DEFAULTS.sigma)
    expect(s.show).toBe(DEFAULTS.show)
    expect(s.stage).toBe(DEFAULTS.stage)
  })

  it('선택한 반복이 뽑은 개수를 넘으면 선택을 지운다', () => {
    expect(parseState(new URLSearchParams('k=5&sel=5')).sel).toBe(-1)
  })

  it('URL에 원자료가 없다 (AC-C3)', () => {
    const p = serializeState({ ...DEFAULTS, k: 1000, seed: 1 })
    expect([...p.keys()].sort()).toEqual(['k', 'seed', 'v'])
  })
})

describe('설정 JSON (AC-C1)', () => {
  it('내보낸 뒤 불러오면 같은 상태', () => {
    const s = { ...DEFAULTS, mu: 3, k: 250, seed: 99, method: 't' as const }
    const j = JSON.parse(JSON.stringify(settingsJson(s, 'E01')))
    expect(stateFromSettings(j)).toEqual(s)
    expect(j.rng_algorithm).toBe('xoshiro128ss-v1')
    expect(j.tails).toEqual({ alt: 'two', alpha_L: 0.025000000000000022, alpha_U: 0.025000000000000022 })
  })
  it('형식이 다르면 거부', () => {
    expect(stateFromSettings({ schema_version: 99, url_state: '' })).toBeNull()
    expect(stateFromSettings('x')).toBeNull()
  })
})

describe('CSV (AC-C2, AC-E01-2)', () => {
  it('행 수 = 반복 수, 포함 합 = 포함 개수, 빈칸 규칙', () => {
    const s = { ...DEFAULTS, k: 300, seed: 5 }
    const sum = summarize(s, 0, 300)
    const csv = replicatesCsv(s, sum, 300, 'E01')
    const lines = csv.trim().split('\n').filter((l) => !l.startsWith('#'))
    expect(lines[0]).toBe(CSV_FIELDS.join(','))
    const rows = lines.slice(1).map((l) => l.split(','))
    expect(rows.length).toBe(300)
    const ci = CSV_FIELDS.indexOf('contains_truth')
    const covered = rows.reduce((a, r) => a + Number(r[ci]), 0)
    expect(covered).toBeGreaterThan(270)
    expect(rows[0][CSV_FIELDS.indexOf('posterior_mass')]).toBe('')
    expect(rows[0][CSV_FIELDS.indexOf('components')]).toBe('')
  })
})

describe('R 코드', () => {
  it('교재 재현 설정이 들어간다', () => {
    const code = rCode({ ...DEFAULTS, mu: 0, sigma: 1, n: 10, method: 't', k: 100, seed: 8 })
    expect(code).toContain('B <- 100; n <- 10; mu <- 0; sigma <- 1; level <- 0.95')
    expect(code).toContain('t.test(x, conf.level = level)')
    expect(code).toContain('set.seed(8)')
  })
})

describe('이항 상태와 내보내기', () => {
  it('이항 설정 왕복과 x ≤ n 보정', () => {
    const s = { ...DEFAULTS, model: 'binom' as const, bn: 30, bx: 9, p0: 0.41, ps: 0.2, bmethod: 'wald' as const, cmp: true, stage: 4 }
    expect(parseState(serializeState(s))).toEqual(s)
    expect(parseState(new URLSearchParams('model=binom&bn=5&bx=9')).bx).toBe(5)
    expect(parseState(new URLSearchParams('bn=0&p0=2&bmethod=x&model=q'))).toMatchObject({ bn: 10, p0: 0.3, bmethod: 'cp', model: 'normal' })
  })

  it('설정 JSON은 이항 모형을 기록한다', () => {
    const s = { ...DEFAULTS, model: 'binom' as const, seed: 3, k: 10 }
    const j = settingsJson(s, 'E02')
    expect(j.model).toBe('binomial')
    expect(j.method_ids).toEqual(['binom_cp'])
    expect(j.generation_parameters).toEqual({ p: 0.3, n: 10 })
    expect(settingsJson(s, 'E01').model).toBe('normal-mean')
  })

  it('이항 CSV: 행 수와 포함 판정', () => {
    const s = { ...DEFAULTS, model: 'binom' as const, seed: 3, k: 4 }
    const csv = binomCsv(s, [3, 0, 10, 7], 4)
    const rows = csv.trim().split('\n').filter((l) => !l.startsWith('#')).slice(1).map((l) => l.split(','))
    expect(rows.length).toBe(4)
    const ci = CSV_FIELDS.indexOf('contains_truth')
    // CP: x=0 → [0, 0.3085]는 0.3을 포함, x=10·7은 포함하지 않음
    expect(rows.map((r) => r[ci])).toEqual(['1', '1', '0', '0'])
    expect(Math.abs(Number(rows[0][CSV_FIELDS.indexOf('lower')]) - 0.0667395)).toBeLessThan(1e-6)
  })
})
