// 학습 자료 콘텐츠의 무결성과 진단 채점
import { describe, expect, it } from 'vitest'
import { DIAG_ITEMS } from '../src/content/diagnostic'
import { GLOSSARY, INTERPRETATIONS, MISCONCEPTIONS } from '../src/content/guide'
import { METHODS } from '../src/content/methods'
import { SOURCES } from '../src/content/sources'
import { EXPERIMENTS } from '../src/components/lab'
import { holdsM1, itemCorrect, misconceptionCounts, normalizedGain, score, type Answers } from '../src/lib/diagnostic'

const expIds = new Set(EXPERIMENTS.map((e) => e.id))
const misIds = new Set(MISCONCEPTIONS.map((m) => m.id))

describe('콘텐츠 무결성', () => {
  it('오개념 M1–M11, 모든 링크가 있는 실험을 가리킨다', () => {
    expect(MISCONCEPTIONS.map((m) => m.id)).toEqual(Array.from({ length: 11 }, (_, i) => `M${i + 1}`))
    for (const m of MISCONCEPTIONS) for (const e of m.exps) expect(expIds.has(e), `${m.id} → ${e}`).toBe(true)
    for (const g of GLOSSARY) if (g.exp) expect(expIds.has(g.exp), g.ko).toBe(true)
    for (const m of METHODS) expect(expIds.has(m.exp), m.id).toBe(true)
    for (const it of DIAG_ITEMS) expect(expIds.has(it.exp), it.id).toBe(true)
  })
  it('해석 카드와 진단 문항의 오개념 ID가 카탈로그에 있다', () => {
    for (const c of INTERPRETATIONS) if (c.mis) expect(misIds.has(c.mis)).toBe(true)
    for (const it of DIAG_ITEMS) {
      for (const m of it.mis) expect(misIds.has(m), it.id).toBe(true)
      for (const o of [...it.answers, ...it.reasons]) if (o.mis) expect(misIds.has(o.mis), `${it.id}: ${o.text}`).toBe(true)
    }
  })
  it('진단 문항 12개, 각 문항에 정답 답·이유가 정확히 하나, 모든 오개념을 덮는다', () => {
    expect(DIAG_ITEMS).toHaveLength(12)
    expect(new Set(DIAG_ITEMS.map((d) => d.id)).size).toBe(12)
    for (const it of DIAG_ITEMS) {
      expect(it.answers.filter((o) => o.correct), it.id).toHaveLength(1)
      expect(it.reasons.filter((o) => o.correct), it.id).toHaveLength(1)
    }
    const covered = new Set(DIAG_ITEMS.flatMap((d) => d.mis))
    for (const m of misIds) expect(covered.has(m), m).toBe(true)
  })
  it('방법 ID와 출처 ID가 겹치지 않는다', () => {
    expect(new Set(METHODS.map((m) => m.id)).size).toBe(METHODS.length)
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length)
  })
})

describe('진단 채점', () => {
  const best: Answers = Object.fromEntries(DIAG_ITEMS.map((it) => [it.id, [it.answers.findIndex((o) => o.correct), it.reasons.findIndex((o) => o.correct)]]))
  it('모두 맞히면 100점, 오개념 0개', () => {
    expect(score(best)).toBe(100)
    expect(misconceptionCounts(best)).toEqual({})
    expect(holdsM1(best)).toBe(false)
  })
  it('답이 맞아도 이유가 틀리면 오답', () => {
    const d01 = DIAG_ITEMS[0]
    expect(itemCorrect(d01, [1, 1])).toBe(false)
    expect(itemCorrect(d01, [1, 0])).toBe(true)
    const a = { ...best, D01: [1, 1] as [number, number] }
    expect(score(a)).toBeCloseTo((100 * 11) / 12, 10)
    expect(misconceptionCounts(a)).toEqual({ M1: 1 })
    expect(holdsM1(a)).toBe(true)
  })
  it('응답하지 않은 문항은 오답', () => {
    expect(score({})).toBe(0)
  })
  it('정규화 이득', () => {
    expect(normalizedGain(40, 70)).toBeCloseTo(0.5, 12)
    expect(normalizedGain(50, 50)).toBe(0)
    expect(Number.isNaN(normalizedGain(100, 100))).toBe(true)
  })
})
