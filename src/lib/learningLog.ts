// 학습기록 (PRD v2 §12.4). 브라우저에만 저장하고, 학습자가 직접 내보낼 때만 밖으로 나간다.
const KEY = 'interval-lab:log:v1'

export interface LogEntry {
  experiment_id: string
  item_id: string
  misconception_ids: string[]
  prediction: string
  confidence: number
  reason: string
  correct: boolean
  result_summary: string
  timestamp: string
}

export function readLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function appendLog(e: LogEntry) {
  try {
    const all = readLog()
    all.push(e)
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 저장할 수 없어도 학습은 계속된다 */
  }
}

export function clearLog() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}
