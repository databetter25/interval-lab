// 실험 방문 기록 (PRD v2 §2.3 예상 단계 응답률의 분모). 브라우저에만 저장한다.
const KEY = 'interval-lab:visits:v1'

export interface Visit {
  first: string
  last: string
  count: number
}

export function readVisits(): Record<string, Visit> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

export function recordVisit(code: string) {
  try {
    const all = readVisits()
    const now = new Date().toISOString()
    const v = all[code]
    all[code] = v ? { ...v, last: now, count: v.count + 1 } : { first: now, last: now, count: 1 }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 저장할 수 없어도 학습은 계속된다 */
  }
}

export function clearVisits() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}
