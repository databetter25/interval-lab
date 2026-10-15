// 파일럿 제출 파일 (PRD v2 §12.6): 학습자가 동의한 경우에만 직접 내보내 제출한다.
// 진단은 브라우저에서 채점한 결과를 함께 담아, 분석 스크립트(tools/pilot_analysis.py)가 문항 정답표 없이 읽을 수 있게 한다.
import { DIAG_ITEMS } from '../content/diagnostic'
import { holdsM1, itemCorrect, readAttempts, score, type Attempt } from './diagnostic'
import { readLog } from './learningLog'
import { readVisits } from './visits'

export const PILOT_SCHEMA = 'interval-lab-pilot'

function scoreAttempt(at: Attempt) {
  const interp = DIAG_ITEMS.filter((it) => it.kind === 'interp')
  return {
    timestamp: at.timestamp,
    answers: at.answers,
    score: score(at.answers),
    interp_score: score(at.answers, interp),
    holds_m1: holdsM1(at.answers),
    items: Object.fromEntries(
      DIAG_ITEMS.map((it) => {
        const a = at.answers[it.id]
        const picked = a ? [it.answers[a[0]], it.reasons[a[1]]] : []
        return [it.id, { answered: !!a, correct: itemCorrect(it, a), misconceptions: picked.flatMap((o) => (o?.mis ? [o.mis] : [])) }]
      }),
    ),
  }
}

export function buildPilotExport(participantId: string) {
  const at = readAttempts()
  return {
    schema: PILOT_SCHEMA,
    schema_version: 1,
    participant_id: participantId.trim(),
    exported_at: new Date().toISOString(),
    items: DIAG_ITEMS.map((it) => ({ id: it.id, kind: it.kind, misconceptions: it.mis })),
    diagnostic: {
      pre: at.pre ? scoreAttempt(at.pre) : null,
      post: at.post ? scoreAttempt(at.post) : null,
    },
    log: readLog(),
    visits: readVisits(),
  }
}
