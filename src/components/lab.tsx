// 실험 화면 공통 부품: 실험 탭, 예상 질문, 설명 탭, 내보내기 (PRD v2 §4.2, §6.2, §12.5)
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { appendLog } from '../lib/learningLog'
import { downloadPng, downloadSvg, downloadText } from '../lib/download'
import { settingsJson, stateFromSettings } from '../lib/exports'
import type { LabState, Update } from '../state/labState'

export const EXPERIMENTS = [
  { id: 'e01', code: 'E01', title: '반복표집 실험실', short: '고정된 참값과 움직이는 구간', tier: 'P0' },
  { id: 'e02', code: 'E02', title: '채택역에서 신뢰띠로', short: '검정을 쌓으면 구간이 된다', tier: 'P0' },
  { id: 'e03', code: 'E03', title: '피벗량으로 구간 만들기', short: 'z·t·χ²·F, 꼬리 배분과 비유일성', tier: 'P0' },
  { id: 'e04', code: 'E04', title: '검정 역산과 p-값 함수', short: '기각되지 않는 μ₀의 모임', tier: 'P0' },
  { id: 'e05', code: 'E05', title: '설계 변수', short: '신뢰수준·표본크기·표준편차', tier: 'P0' },
  { id: 'e06', code: 'E06', title: '이항구간 비교', short: '어떤 검정을 뒤집는가, 정확 포함률', tier: 'P0' },
  { id: 'e07', code: 'E07', title: '같은 구간, 세 관점', short: '네이만·피셔·베이즈 — 확률은 어디에 붙는가', tier: 'P0' },
  { id: 'e08', code: 'E08', title: '추정 대상이 다른 구간', short: '신뢰·신용·예측·허용구간', tier: 'P0' },
  { id: 'e09', code: 'E09', title: '가정 위반과 대표본 근사', short: '모양이 다른 모집단에서 t·z·χ² 구간', tier: 'P1' },
  { id: 'e10', code: 'E10', title: '정확성: 검정력과 길이', short: '오포함확률 = 1 − 검정력, Pratt 항등식', tier: 'P1' },
  { id: 'e11', code: 'E11', title: '두 모집단', short: '독립·대응·두 비율', tier: 'P1' },
  { id: 'e12', code: 'E12', title: '베이즈 심화: 동일꼬리·HPD', short: 'HPD, 끊어진 집합, 재매개화, 사전 민감도', tier: 'P1' },
  { id: 'e13', code: 'E13', title: 'CDF 역산과 비유일성', short: 'Uniform(0, θ)의 최댓값, 최단 구간', tier: 'P1' },
  { id: 'e14', code: 'E14', title: '부트스트랩 구간', short: '재표집분포, 백분위수·basic·BCa', tier: 'P2' },
  { id: 'e15', code: 'E15', title: '일반화 피듀셜', short: '로그정규 평균, 일반화 피벗량(GPQ)', tier: 'P2' },
] as const

export function LabTabs({ current }: { current: string }) {
  const { search } = useLocation()
  return (
    <nav className="lab-tabs-wrap" aria-label="실험 선택">
      {(['P0', 'P1', 'P2'] as const).map((tier) => (
        <div key={tier} className="lab-tabs">
          <span className="lab-tier">{tier === 'P0' ? '핵심' : tier === 'P1' ? '심화' : '확장'}</span>
          {EXPERIMENTS.filter((e) => e.tier === tier).map((e) => (
            <Link key={e.id} className="lab-tab" to={`/lab/${e.id}${search}`} aria-current={e.id === current ? 'page' : undefined} title={e.short}>
              <span className="tab-id">{e.code}</span>
              {e.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

export interface Choice {
  text: string
  correct?: boolean
  /** 이 선택지가 드러내는 오개념 ID (PRD v2 §1.2) */
  misconception?: string
  feedback: string
}

interface PredictProps {
  experimentId: string
  itemId: string
  question: ReactNode
  choices: Choice[]
  /** 실행 결과가 나와 피드백을 보여 줄 수 있는가 */
  revealed: boolean
  /** 아직 결과가 없을 때의 안내 */
  waitHint: string
  /** 결과 요약 (피드백과 기록에 쓴다) */
  resultSummary: string
}

/** 실행 전 예상: 선택 + 확신도 + 한 줄 이유 (PRD v2 §11.1) */
export function Predict({ experimentId, itemId, question, choices, revealed, waitHint, resultSummary }: PredictProps) {
  const [pick, setPick] = useState<number | null>(null)
  const [conf, setConf] = useState(0)
  const [reason, setReason] = useState('')
  const [locked, setLocked] = useState(false)
  const logged = useRef(false)

  const show = locked && revealed && pick !== null
  useEffect(() => {
    if (!show || logged.current) return
    logged.current = true
    const c = choices[pick!]
    appendLog({
      experiment_id: experimentId,
      item_id: itemId,
      misconception_ids: c.misconception ? [c.misconception] : [],
      prediction: c.text,
      confidence: conf,
      reason,
      correct: !!c.correct,
      result_summary: resultSummary,
      timestamp: new Date().toISOString(),
    })
  }, [show, choices, pick, conf, reason, experimentId, itemId, resultSummary])

  return (
    <section className="question-bar" aria-labelledby={`${itemId}-q`}>
      <p className="eyebrow" style={{ margin: '0 0 4px' }}>
        실행 전에 예상하기
      </p>
      <p className="q" id={`${itemId}-q`}>
        {question}
      </p>
      <div className="predict-grid" role="radiogroup" aria-labelledby={`${itemId}-q`}>
        {choices.map((c, i) => {
          const cls = show ? (c.correct ? ' correct' : i === pick ? ' wrong' : '') : i === pick ? ' picked' : ''
          return (
            <button key={i} type="button" role="radio" aria-checked={i === pick} className={`choice${cls}`} disabled={locked} onClick={() => setPick(i)}>
              <span className="choice-num">{i + 1}</span>
              <span>{c.text}</span>
            </button>
          )
        })}
      </div>
      {!locked && (
        <div className="confidence-row">
          <span>확신도</span>
          {[1, 2, 3, 4].map((v) => (
            <button key={v} type="button" className="btn-outline sm" aria-pressed={conf === v} onClick={() => setConf(v)}>
              {['찍음', '조금', '꽤', '확실'][v - 1]}
            </button>
          ))}
          <input className="num-input" style={{ flex: '1 1 200px', minWidth: 0 }} placeholder="이유 한 줄 (선택)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="예상한 이유" />
          <button type="button" className="btn-filled sm" disabled={pick === null} onClick={() => setLocked(true)}>
            예상 확정
          </button>
        </div>
      )}
      {locked && !revealed && (
        <p className="feedback no" role="status">
          예상을 기록했습니다. {waitHint}
        </p>
      )}
      {show && (
        <div className={`feedback ${choices[pick!].correct ? 'ok' : 'no'}`} role="status">
          <strong>{choices[pick!].correct ? '예상이 맞았습니다.' : '결과는 예상과 달랐습니다.'}</strong> {resultSummary}
          <p style={{ margin: '6px 0 0' }}>{choices[pick!].feedback}</p>
          {!choices[pick!].correct && <p style={{ margin: '6px 0 0' }}>정답: {choices.find((c) => c.correct)?.text} — {choices.find((c) => c.correct)?.feedback}</p>}
          {choices[pick!].misconception && <p className="mis">관련 오개념 {choices[pick!].misconception}</p>}
          <button type="button" className="btn-ghost" style={{ padding: '4px 0', marginTop: 4 }} onClick={() => { setLocked(false); setPick(null); setConf(0); setReason(''); logged.current = false }}>
            조건을 바꿔 다시 예상하기
          </button>
        </div>
      )}
    </section>
  )
}

/** 직관 / 계산 / 증명 탭. 탭을 바꿔도 실험 상태는 그대로다 */
export function ExplainTabs({ intuition, calc, proof }: { intuition: ReactNode; calc: ReactNode; proof: ReactNode }) {
  const [tab, setTab] = useState<'i' | 'c' | 'p'>('i')
  const tabs = [
    { id: 'i' as const, label: '직관', body: intuition },
    { id: 'c' as const, label: '계산', body: calc },
    { id: 'p' as const, label: '증명', body: proof },
  ]
  return (
    <div className="explain-tabs">
      <div className="tab-nav" role="tablist" aria-label="설명 수준">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`tabpanel-${t.id}`} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`tabpanel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id} className="explain">
          {t.body}
        </div>
      ))}
    </div>
  )
}

interface ExportProps {
  s: LabState
  update: Update
  experimentId: string
  svgRef: RefObject<SVGSVGElement | null>
  csv?: () => string
  rCode?: () => string
  /** 실험별 추가 내보내기 */
  extra?: { label: string; filename: string; make: () => string; type?: string }[]
}

export function ExportBar({ s, update, experimentId, svgRef, csv, rCode, extra = [] }: ExportProps) {
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const flash = (t: string) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 2500)
  }
  const base = `interval-lab-${experimentId.toLowerCase()}`
  return (
    <div className="export-bar">
      <span className="label">공유·내보내기</span>
      <button
        type="button"
        className="btn-outline sm"
        onClick={() =>
          navigator.clipboard?.writeText(location.href).then(
            () => flash('링크를 복사했습니다. 원자료는 들어 있지 않습니다.'),
            () => flash('복사할 수 없습니다. 주소창의 주소를 쓰세요.'),
          )
        }
      >
        링크 복사
      </button>
      <button type="button" className="btn-outline sm" onClick={() => downloadText(JSON.stringify(settingsJson(s, experimentId), null, 2), `${base}-settings.json`, 'application/json')}>
        설정 JSON
      </button>
      <button type="button" className="btn-outline sm" onClick={() => fileRef.current?.click()}>
        설정 불러오기
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="설정 JSON 파일 선택"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const st = stateFromSettings(JSON.parse(await f.text()))
            if (!st) return flash('이 사이트의 설정 파일이 아닙니다.')
            update(st)
            flash('설정을 불러왔습니다.')
          } catch {
            flash('JSON을 읽을 수 없습니다.')
          }
        }}
      />
      {csv && (
        <button type="button" className="btn-outline sm" onClick={() => downloadText(csv(), `${base}-results.csv`, 'text/csv;charset=utf-8')}>
          결과 CSV
        </button>
      )}
      <button type="button" className="btn-outline sm" onClick={() => svgRef.current && downloadSvg(svgRef.current, `${base}.svg`)}>
        그림 SVG
      </button>
      <button type="button" className="btn-outline sm" onClick={() => svgRef.current && downloadPng(svgRef.current, `${base}.png`)}>
        그림 PNG
      </button>
      {extra.map((e) => (
        <button key={e.label} type="button" className="btn-outline sm" onClick={() => downloadText(e.make(), `${base}-${e.filename}`, e.type ?? 'text/csv;charset=utf-8')}>
          {e.label}
        </button>
      ))}
      {rCode && (
        <button type="button" className="btn-outline sm" onClick={() => downloadText(rCode(), `${base}.R`)}>
          R 코드
        </button>
      )}
      <span className="toast" role="status">
        {msg}
      </span>
    </div>
  )
}

export function AssumptionBadges({ items }: { items: string[] }) {
  return (
    <div className="row" style={{ gap: 6, margin: '8px 0' }}>
      {items.map((t) => (
        <span key={t} className="badge badge-gray">
          가정 · {t}
        </span>
      ))}
    </div>
  )
}
