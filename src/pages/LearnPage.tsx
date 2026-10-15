// 학습 자료 (PRD v2 §6.1): 용어·해석, 방법 카탈로그, 진단, 역사와 논쟁, 출처
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, useLocation, useParams } from 'react-router-dom'
import { EXPERIMENTS } from '../components/lab'
import { StatGrid, Tex } from '../components/ui'
import { DIAG_ITEMS } from '../content/diagnostic'
import { GLOSSARY, INTERPRETATIONS, MISCONCEPTIONS, misconceptionById } from '../content/guide'
import { CONSTRUCTION_LABEL, GUARANTEE_LABEL, METHODS, type Construction, type Guarantee } from '../content/methods'
import { SOURCES } from '../content/sources'
import { clearAttempts, holdsM1, itemCorrect, misconceptionCounts, normalizedGain, readAttempts, saveAttempt, score, type Answers, type Attempt, type Phase } from '../lib/diagnostic'
import { downloadText } from '../lib/download'

const TABS = [
  { id: 'guide', label: '용어·해석' },
  { id: 'methods', label: '방법 카탈로그' },
  { id: 'diagnose', label: '진단' },
  { id: 'history', label: '역사와 논쟁' },
  { id: 'sources', label: '출처' },
] as const

const expCode = (id: string) => EXPERIMENTS.find((e) => e.id === id)?.code ?? id.toUpperCase()

function ExpLinks({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ', '}
          <Link to={`/lab/${id}`}>{expCode(id)}</Link>
        </span>
      ))}
    </>
  )
}

export function LearnPage() {
  const { tab = 'guide' } = useParams()
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/learn/guide" replace />
  return (
    <div className="container narrow learn">
      <header className="lab-head">
        <p className="eyebrow">학습 자료</p>
        <h1>{TABS.find((t) => t.id === tab)!.label}</h1>
      </header>
      <nav className="lab-tabs" aria-label="학습 자료">
        {TABS.map((t) => (
          <NavLink key={t.id} to={`/learn/${t.id}`} className="lab-tab">
            {t.label}
          </NavLink>
        ))}
      </nav>
      {tab === 'guide' && <GuideTab />}
      {tab === 'methods' && <MethodsTab />}
      {tab === 'diagnose' && <DiagnoseTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'sources' && <SourcesTab />}
    </div>
  )
}

/* ---------------- 용어·해석 ---------------- */

function GuideTab() {
  return (
    <>
      <section className="teach-section">
        <h2>필수 해석과 금지 해석</h2>
        <p className="desc">사이트의 모든 문구는 왼쪽을 기준으로 씁니다. 오른쪽은 교정할 표현입니다.</p>
        <div className="interp-grid">
          {INTERPRETATIONS.map((c, i) => (
            <div key={i} className="interp-card panel">
              <p className="interp-ok">
                <span className="badge badge-blue">이렇게</span> {c.ok}
              </p>
              <p className="interp-no">
                <span className="badge badge-gray">이렇게 말하지 않기</span> <s>{c.no}</s>
              </p>
              {c.mis && <p className="kbd-help">관련 오개념 {c.mis}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="teach-section">
        <h2>오개념 카탈로그</h2>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="오개념 카탈로그 표">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">오개념</th>
                <th scope="col">교정할 이해</th>
                <th scope="col">실험</th>
              </tr>
            </thead>
            <tbody>
              {MISCONCEPTIONS.map((m) => (
                <tr key={m.id} id={m.id}>
                  <th scope="row">{m.id}</th>
                  <td>{m.wrong}</td>
                  <td>{m.right}</td>
                  <td>
                    <ExpLinks ids={m.exps} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="teach-section">
        <h2>용어집 (한–영)</h2>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="용어집 표">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th scope="col">한국어</th>
                <th scope="col">English</th>
                <th scope="col">비고</th>
                <th scope="col">실험</th>
              </tr>
            </thead>
            <tbody>
              {GLOSSARY.map((g) => (
                <tr key={g.ko}>
                  <th scope="row">{g.ko}</th>
                  <td lang="en">{g.en}</td>
                  <td>{g.note ?? ''}</td>
                  <td>{g.exp ? <ExpLinks ids={[g.exp]} /> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/* ---------------- 방법 카탈로그 ---------------- */

function MethodsTab() {
  const [cons, setCons] = useState<Construction | 'all'>('all')
  const [guar, setGuar] = useState<Guarantee | 'all'>('all')
  const [scope, setScope] = useState<'all' | '교재' | '확장'>('all')
  const list = METHODS.filter((m) => (cons === 'all' || m.construction === cons) && (guar === 'all' || m.guarantee === guar) && (scope === 'all' || m.scope === scope))
  return (
    <>
      <p className="desc">사이트에서 쓰는 구간 방법마다 대상, 구성, 뒤집은 검정, 가정, 포함률 보장을 정리했습니다. ‘보장’은 반복표집 포함률에 대한 이론적 보장이고, 실제 포함률은 각 실험에서 확인할 수 있습니다.</p>
      <div className="method-filters">
        <label>
          구성{' '}
          <select value={cons} onChange={(e) => setCons(e.target.value as Construction | 'all')}>
            <option value="all">전체</option>
            {(Object.keys(CONSTRUCTION_LABEL) as Construction[]).map((c) => (
              <option key={c} value={c}>
                {CONSTRUCTION_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          보장{' '}
          <select value={guar} onChange={(e) => setGuar(e.target.value as Guarantee | 'all')}>
            <option value="all">전체</option>
            {(Object.keys(GUARANTEE_LABEL) as Guarantee[]).map((g) => (
              <option key={g} value={g}>
                {GUARANTEE_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
        <label>
          범위{' '}
          <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | '교재' | '확장')}>
            <option value="all">전체</option>
            <option value="교재">교재</option>
            <option value="확장">확장</option>
          </select>
        </label>
        <span className="kbd-help" role="status">
          {list.length}개 방법
        </span>
      </div>
      <div className="method-list">
        {list.map((m) => (
          <article key={m.id} className="panel method-card" aria-labelledby={`m-${m.id}`}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h3 id={`m-${m.id}`} style={{ margin: 0 }}>
                {m.label} <span className="kbd-help" lang="en">{m.labelEn}</span>
              </h3>
              <span>
                <span className={`badge ${m.scope === '교재' ? 'badge-blue' : 'badge-gray'}`}>{m.scope === '교재' ? `교재 ${m.section}` : `확장${m.section !== '확장' ? ` · ${m.section}` : ''}`}</span>{' '}
                <span className="badge badge-gray">{m.exact ? '정확' : '근사'}</span>
              </span>
            </div>
            <div className="method-formula">
              <Tex block>{m.formula}</Tex>
            </div>
            <dl className="method-dl">
              <dt>대상</dt>
              <dd>{m.estimand} ({m.model})</dd>
              <dt>구성</dt>
              <dd>
                {CONSTRUCTION_LABEL[m.construction]}
                {m.invertedTest ? ` — 뒤집은 검정: ${m.invertedTest}` : ''}
              </dd>
              <dt>가정</dt>
              <dd>{m.assumptions.join(' · ')}</dd>
              <dt>포함률 보장</dt>
              <dd>{GUARANTEE_LABEL[m.guarantee]}</dd>
              {m.boundary && (
                <>
                  <dt>경계</dt>
                  <dd>{m.boundary}</dd>
                </>
              )}
              {m.set && (
                <>
                  <dt>모양</dt>
                  <dd>여러 조각의 집합일 수 있음</dd>
                </>
              )}
              <dt>실험</dt>
              <dd>
                <ExpLinks ids={[m.exp]} />
              </dd>
            </dl>
          </article>
        ))}
      </div>
    </>
  )
}

/* ---------------- 진단 ---------------- */

function DiagnoseTab() {
  const [attempts, setAttempts] = useState(() => readAttempts())
  const [phase, setPhase] = useState<Phase>(() => (readAttempts().pre ? 'post' : 'pre'))
  const [answers, setAnswers] = useState<Partial<Record<string, [number | null, number | null]>>>({})
  const [submitted, setSubmitted] = useState<Attempt | null>(null)
  const done = DIAG_ITEMS.filter((it) => answers[it.id]?.[0] != null && answers[it.id]?.[1] != null).length

  const pick = (id: string, k: 0 | 1, v: number) => {
    const cur = answers[id] ?? [null, null]
    const next: [number | null, number | null] = [...cur]
    next[k] = v
    setAnswers({ ...answers, [id]: next })
  }
  const submit = () => {
    const a: Answers = {}
    for (const it of DIAG_ITEMS) {
      const v = answers[it.id]
      if (v && v[0] != null && v[1] != null) a[it.id] = [v[0], v[1]]
    }
    const at: Attempt = { phase, answers: a, timestamp: new Date().toISOString() }
    saveAttempt(at)
    setAttempts(readAttempts())
    setSubmitted(at)
    window.scrollTo(0, 0)
  }

  if (submitted) return <DiagResult at={submitted} attempts={attempts} onAgain={() => { setSubmitted(null); setAnswers({}); setPhase(attempts.pre ? 'post' : 'pre') }} />

  return (
    <>
      <p className="desc">
        답과 그 이유를 함께 고르는 2단계 문항 12개입니다. 둘 다 맞아야 정답으로 셉니다. 실험을 시작하기 전에 <b>사전</b>, 학습을 마친 뒤 <b>사후</b>로 한 번씩 풀면 변화를 비교할 수 있습니다. 결과는 이 브라우저에만 저장됩니다.
      </p>
      <p className="note">문항은 교재·워크북을 옮기지 않고 새로 쓴 초안이며, 교수 검토 전입니다.</p>
      <div className="method-filters" role="radiogroup" aria-label="진단 단계">
        {(['pre', 'post'] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={phase === p} className={phase === p ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => setPhase(p)}>
            {p === 'pre' ? '사전 진단' : '사후 진단'}
            {attempts[p] ? ' (응시함)' : ''}
          </button>
        ))}
      </div>
      <ol className="diag-list">
        {DIAG_ITEMS.map((it) => (
          <li key={it.id} className="panel diag-item">
            <p className="q" id={`${it.id}-q`}>
              <span className="kbd-help">{it.id}</span> {it.stem}
            </p>
            <fieldset>
              <legend>답</legend>
              {it.answers.map((o, i) => (
                <label key={i} className="diag-opt">
                  <input type="radio" name={`${it.id}-a`} checked={answers[it.id]?.[0] === i} onChange={() => pick(it.id, 0, i)} /> {o.text}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>이유</legend>
              {it.reasons.map((o, i) => (
                <label key={i} className="diag-opt">
                  <input type="radio" name={`${it.id}-r`} checked={answers[it.id]?.[1] === i} onChange={() => pick(it.id, 1, i)} /> {o.text}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="run-bar">
        <button type="button" className="btn-filled" onClick={submit} disabled={done === 0}>
          {phase === 'pre' ? '사전' : '사후'} 진단 제출
        </button>
        <span className="kbd-help" role="status">
          {done} / {DIAG_ITEMS.length} 문항 응답
        </span>
      </div>
    </>
  )
}

function DiagResult({ at, attempts, onAgain }: { at: Attempt; attempts: Partial<Record<Phase, Attempt>>; onAgain: () => void }) {
  const counts = misconceptionCounts(at.answers)
  const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || Number(a.slice(1)) - Number(b.slice(1)))
  const s = score(at.answers)
  const pre = attempts.pre
  const post = attempts.post
  const gain = pre && post ? normalizedGain(score(pre.answers), score(post.answers)) : NaN
  const exportJson = () => downloadText(JSON.stringify({ schema_version: 1, items: DIAG_ITEMS.map((d) => d.id), ...attempts }, null, 2), 'interval-lab-diagnostic.json', 'application/json')
  return (
    <>
      <section className="teach-section" aria-labelledby="diag-mis">
        <h2 id="diag-mis">{at.phase === 'pre' ? '사전' : '사후'} 진단: 먼저 오개념부터</h2>
        {ids.length === 0 ? (
          <p className="feedback ok">고른 답과 이유에서 오개념이 드러나지 않았습니다.</p>
        ) : (
          <ul className="mis-list">
            {ids.map((id) => {
              const m = misconceptionById(id)!
              return (
                <li key={id} className="panel">
                  <strong>
                    {id} · {counts[id]}번 선택
                  </strong>
                  <p style={{ margin: '4px 0' }}>
                    <s>{m.wrong}</s>
                  </p>
                  <p style={{ margin: '4px 0' }}>{m.right}</p>
                  <p className="kbd-help" style={{ margin: 0 }}>
                    다시 보기: <ExpLinks ids={m.exps} />
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="teach-section">
        <h2>점수</h2>
        <StatGrid
          stats={[
            { tag: '이번 정답률', label: `답과 이유가 모두 맞은 문항 ${Math.round((s * DIAG_ITEMS.length) / 100)}개`, value: `${s.toFixed(0)}%` },
            ...(pre && post
              ? [
                  {
                    tag: '사전 → 사후',
                    label: `정규화 이득 ${Number.isFinite(gain) ? gain.toFixed(2) : '—'} · M1 보유 ${holdsM1(pre.answers) ? '예' : '아니오'} → ${holdsM1(post.answers) ? '예' : '아니오'}`,
                    value: `${score(pre.answers).toFixed(0)}% → ${score(post.answers).toFixed(0)}%`,
                    tone: 'orange' as const,
                  },
                ]
              : []),
          ]}
        />
        <ol className="diag-list">
          {DIAG_ITEMS.map((it) => {
            const a = at.answers[it.id]
            const ok = itemCorrect(it, a)
            return (
              <li key={it.id} className={`panel diag-item ${ok ? 'ok' : 'no'}`}>
                <p className="q">
                  <span className="kbd-help">{it.id}</span> {ok ? '○' : '✕'} {it.stem}
                </p>
                {!ok && (
                  <p style={{ margin: '4px 0' }}>
                    정답: {it.answers.find((o) => o.correct)!.text} / 이유: {it.reasons.find((o) => o.correct)!.text}
                  </p>
                )}
                <p className="kbd-help" style={{ margin: 0 }}>
                  {it.explain} <Link to={`/lab/${it.exp}`}>{expCode(it.exp)}에서 확인</Link>
                </p>
              </li>
            )
          })}
        </ol>
        <div className="run-bar">
          <button type="button" className="btn-outline sm" onClick={onAgain}>
            다시 풀기
          </button>
          <button type="button" className="btn-outline sm" onClick={exportJson}>
            진단 결과 JSON 내보내기
          </button>
          <button
            type="button"
            className="btn-ghost sm"
            onClick={() => {
              if (confirm('이 브라우저의 사전·사후 진단 결과를 지울까요?')) {
                clearAttempts()
                onAgain()
              }
            }}
          >
            진단 결과 지우기
          </button>
        </div>
        <p className="chart-caption">파일럿에서는 내보낸 JSON을 학습자가 동의한 경우에만 제출합니다. 사이트는 아무것도 서버로 보내지 않습니다.</p>
      </section>
    </>
  )
}

/* ---------------- 역사와 논쟁 ---------------- */

const TIMELINE: { year: string; fact: string; src: string; note?: string }[] = [
  { year: '1763', fact: '베이즈의 논문이 그의 사후에 출판되었다. 관측 뒤 모수에 확률을 매기는 계산의 출발점으로 흔히 꼽힌다.', src: 'Bayes1763' },
  { year: '1927', fact: 'Wilson이 이항비율에 대해 오늘날 Wilson 구간이라 부르는 구성을 제시했다.', src: 'Wilson1927', note: 'E06' },
  { year: '1930', fact: '피셔가 사전분포 없이 모수에 대한 분포를 얻는 피듀셜 논법을 제시했다.', src: 'Fisher1930', note: 'E07' },
  { year: '1934', fact: 'Clopper와 Pearson의 이항 구간 논문 제목에 “confidence or fiducial limits”가 함께 쓰였다.', src: 'CP1934', note: 'E02, E06' },
  { year: '1935', fact: '피셔가 분산이 다른 두 정규평균의 차(Behrens–Fisher 문제)에 피듀셜 논법을 적용했다.', src: 'Fisher1935' },
  { year: '1937', fact: '네이만이 신뢰구간 이론을 체계적으로 제시했다. 채택역을 모아 구간을 만드는 구성이 여기서 정식화된다.', src: 'Neyman1937', note: 'E02' },
  { year: '1979', fact: 'Efron이 부트스트랩을 제안했다.', src: 'Efron1979', note: 'E14' },
  { year: '1993', fact: 'Weerahandi가 일반화 신뢰구간(일반화 피벗량)을 제안했다.', src: 'Weerahandi1993', note: 'E15' },
  { year: '2009', fact: 'Hannig가 일반화 피듀셜 추론을 정리했다.', src: 'Hannig2009', note: 'E15' },
]

function HistoryTab() {
  return (
    <>
      <p className="desc">
        이 탭은 문장마다 <span className="badge badge-blue">사실</span>(출판 연도·내용처럼 문헌에서 확인할 수 있는 것)과 <span className="badge badge-gray">해석</span>(그 의미에 대한 평가)을 구분해 표시합니다.
      </p>
      <section className="teach-section">
        <h2>연표</h2>
        <ol className="timeline">
          {TIMELINE.map((t) => (
            <li key={t.year + t.src} className="panel">
              <strong>{t.year}</strong> <span className="badge badge-blue">사실</span> {t.fact}{' '}
              <Link className="kbd-help" to={`/learn/sources#${t.src}`}>
                [{t.src}]
              </Link>
              {t.note && <span className="kbd-help"> · 관련 실험 {t.note}</span>}
            </li>
          ))}
        </ol>
        <p className="chart-caption">연표의 서지 정보는 출처 탭에 있으며, 원문 대조 전 초안입니다.</p>
      </section>

      <section className="teach-section">
        <h2>같은 구간, 다른 정당화</h2>
        <div className="views-grid">
          <div className="view-card panel">
            <h3>네이만</h3>
            <p>
              <span className="badge badge-gray">해석</span> 확률은 구간을 만드는 절차에 붙습니다. 모수는 고정되어 있고, 반복표집에서 구간이 모수를 포함하는 비율이 1 − α입니다. 관측된 구간 하나에는 확률을 매기지 않습니다.
            </p>
          </div>
          <div className="view-card panel">
            <h3>피셔 (피듀셜)</h3>
            <p>
              <span className="badge badge-gray">해석</span> 피벗량의 분포를 관측값에서 뒤집어, 사전분포 없이 모수에 대한 분포를 얻으려 했습니다. 단순한 정규평균에서는 끝점이 네이만 구간과 같지만, 그 분포를 어떻게 읽어야 하는지와 언제 성립하는지는 오랫동안 논쟁이 되었습니다.
            </p>
          </div>
          <div className="view-card panel">
            <h3>베이즈</h3>
            <p>
              <span className="badge badge-gray">해석</span> 사전분포를 명시하고, 자료가 주어졌을 때 모수에 대한 사후확률을 계산합니다. 신용구간의 1 − α는 사후질량이며 반복표집 포함률을 보장하지 않습니다.
            </p>
          </div>
        </div>
        <p className="chart-caption">
          <span className="badge badge-gray">해석</span> “누구는 이 공식, 누구는 저 공식”이 아닙니다. 정규평균처럼 단순한 경우 세 관점의 끝점은 같고, 다른 것은 그 숫자에 붙는 확률의 대상입니다(<Link to="/lab/e07">E07</Link>).
        </p>
      </section>

      <section className="teach-section">
        <h2>논쟁이 드러난 곳</h2>
        <ul className="mis-list">
          <li className="panel">
            <strong>분산이 다른 두 정규평균</strong>
            <p style={{ margin: '4px 0' }}>
              <span className="badge badge-gray">해석</span> Behrens–Fisher 문제에서 피셔의 피듀셜 구간은 반복표집 포함률이 정확히 1 − α가 되지 않아, 피듀셜 논법과 신뢰구간 이론이 같은 것이 아님을 보여 준 대표 사례로 자주 언급됩니다. 사이트의 Welch 구간(<Link to="/lab/e11">E11</Link>)도 근사입니다.
            </p>
          </li>
          <li className="panel">
            <strong>이산분포</strong>
            <p style={{ margin: '4px 0' }}>
              <span className="badge badge-gray">해석</span> 이항처럼 자료가 띄엄띄엄한 경우 모든 p에서 정확히 1 − α를 맞추는 (무작위화하지 않은) 구간은 없습니다. 보수적인 Clopper–Pearson과, 평균적으로 명목수준에 가까운 근사 구간 사이의 선택이 생깁니다(<Link to="/lab/e06">E06</Link>).
            </p>
          </li>
          <li className="panel">
            <strong>고전적 피듀셜과 현대 확장</strong>
            <p style={{ margin: '4px 0' }}>
              <span className="badge badge-gray">해석</span> 일반화 피벗량과 일반화 피듀셜 추론은 피셔의 원래 논법을 그대로 되살린 것이 아니라, 구성 아이디어를 빌려 오고 성능을 반복표집 포함률로 평가하는 현대적 방법입니다. 사이트는 둘을 구분해 표시합니다(<Link to="/lab/e15">E15</Link>).
            </p>
          </li>
        </ul>
      </section>
    </>
  )
}

/* ---------------- 출처 ---------------- */

function SourcesTab() {
  const [kind, setKind] = useState<string>('all')
  const kinds = useMemo(() => Array.from(new Set(SOURCES.map((s) => s.kind))), [])
  const list = SOURCES.filter((s) => kind === 'all' || s.kind === kind)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'center' })
  }, [hash])
  return (
    <>
      <p className="desc">콘텐츠의 근거 자료입니다. 검토 상태는 초안 → 대조완료(원문과 대조) → 교수검토완료 순으로 바뀝니다. 교재 본문·그림·문항은 싣지 않습니다.</p>
      <div className="method-filters">
        <label>
          종류{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">전체</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="출처 표">
        <table className="data-table compare-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">종류</th>
              <th scope="col">자료</th>
              <th scope="col">쓰인 곳</th>
              <th scope="col">검토</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} id={s.id}>
                <th scope="row">{s.id}</th>
                <td>{s.kind}</td>
                <td>
                  {s.title}
                  {s.section && <div className="kbd-help">{s.section}</div>}
                  {s.url && (
                    <div className="kbd-help">
                      <a href={s.url} target="_blank" rel="noreferrer">
                        링크 ↗
                      </a>
                      {s.accessed && ` (확인 ${s.accessed})`}
                    </div>
                  )}
                  {s.note && <div className="kbd-help">{s.note}</div>}
                </td>
                <td>{s.usedIn.join(', ') || '—'}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
