// 진단 평가 채점과 저장 (PRD v2 §2.3 지표, §11.3). 브라우저에만 저장한다.
import { DIAG_ITEMS, type DiagItem } from '../content/diagnostic'
import { appendLog } from './learningLog'

export type Phase = 'pre' | 'post'

/** 문항 ID → [답 번호, 이유 번호] */
export type Answers = Record<string, [number, number]>

export interface Attempt {
  phase: Phase
  answers: Answers
  timestamp: string
}

const KEY = 'interval-lab:diag:v1'

export function itemCorrect(item: DiagItem, a: [number, number] | undefined): boolean {
  if (!a) return false
  return !!item.answers[a[0]]?.correct && !!item.reasons[a[1]]?.correct
}

/** 정답률 (0–100, 답과 이유가 모두 맞은 문항의 비율) */
export function score(answers: Answers, items: DiagItem[] = DIAG_ITEMS): number {
  return (100 * items.filter((it) => itemCorrect(it, answers[it.id])).length) / items.length
}

/** 고른 답·이유에 붙은 오개념 ID별 횟수 */
export function misconceptionCounts(answers: Answers, items: DiagItem[] = DIAG_ITEMS): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of items) {
    const a = answers[it.id]
    if (!a) continue
    for (const o of [it.answers[a[0]], it.reasons[a[1]]]) if (o?.mis) out[o.mis] = (out[o.mis] ?? 0) + 1
  }
  return out
}

/** 정규화 이득 (사후 − 사전) / (100 − 사전). 사전이 100이면 정의하지 않는다 */
export function normalizedGain(pre: number, post: number): number {
  return pre >= 100 ? NaN : (post - pre) / (100 - pre)
}

/** M1 보유: M1 문항(D01)에서 M1이 붙은 답이나 이유를 골랐는가 */
export function holdsM1(answers: Answers, items: DiagItem[] = DIAG_ITEMS): boolean {
  return items
    .filter((it) => it.mis.includes('M1'))
    .some((it) => {
      const a = answers[it.id]
      return !!a && (it.answers[a[0]]?.mis === 'M1' || it.reasons[a[1]]?.mis === 'M1')
    })
}

export function readAttempts(): Partial<Record<Phase, Attempt>> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function saveAttempt(at: Attempt) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAttempts(), [at.phase]: at }))
  } catch {
    /* 저장할 수 없어도 결과는 화면에 보인다 */
  }
  // 학습기록에도 문항별로 남겨 한 번에 내보낼 수 있게 한다
  for (const it of DIAG_ITEMS) {
    const a = at.answers[it.id]
    if (!a) continue
    const picked = [it.answers[a[0]], it.reasons[a[1]]]
    appendLog({
      experiment_id: `DIAG-${at.phase}`,
      item_id: it.id,
      misconception_ids: picked.flatMap((o) => (o?.mis ? [o.mis] : [])),
      prediction: picked[0]?.text ?? '',
      confidence: 0,
      reason: picked[1]?.text ?? '',
      correct: itemCorrect(it, a),
      result_summary: '',
      timestamp: at.timestamp,
    })
  }
}

export function clearAttempts() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}
