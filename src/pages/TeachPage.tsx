// 강의자 도구 (PRD v2 §4.5 강의 경로, §6.4 강의 모드, §12.3 숨김 링크, P2 강의 자료 묶음)
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { randomSeed } from '../engine/core/rng'
import { SliderField } from '../components/ui'
import { DEFAULTS, serializeState } from '../state/labState'

const LECTURE = [
  { min: 10, title: '“95%는 무엇의 확률인가” 예상 투표', to: '/lab/e01', exp: 'E01', ask: '95% 구간을 100번 만들면 참값을 포함하는 구간은 몇 개일까?', check: '예상 투표 후 ‘100회’ — 포함 개수가 정확히 95가 아님을 확인' },
  { min: 15, title: '표본 1개에서 1,000개까지 — 수렴 깔때기', to: '/lab/e01?B=1000', exp: 'E01', ask: '1,000번 중 938번이면 구현 오류일까?', check: '수렴 깔때기와 100개 묶음 히스토그램, MC 표준오차' },
  { min: 15, title: '7장 z 검정의 채택역을 쌓아 신뢰띠 만들기', to: '/lab/e02?stage=1', exp: 'E02', ask: 'μ₀마다 채택역을 쌓으면 어떤 모양이 될까?', check: '1→4단계(→ 키). 4단계에서 띠 안 비율 = E01 포함률' },
  { min: 10, title: 'μ₀ 슬라이더와 p-값 함수', to: '/lab/e04?mu0=90', exp: 'E04', ask: '기각 결정은 μ₀가 어디를 지날 때 바뀌는가?', check: 'μ₀ = 90에서 p = 0.0455, 끝점에서 p = α' },
  { min: 15, title: 'n = 10 이항에서 Wald·Wilson·CP의 포함률', to: '/lab/e06', exp: 'E06', ask: '교재의 Wald 구간은 95%를 지킬까?', check: '‘포함률 곡선 그리기’ — 톱니 모양, Wald 격자 최솟값' },
  { min: 10, title: '같은 구간에 대한 세 관점의 문장', to: '/lab/e07', exp: 'E07', ask: '네이만·베이즈·피듀셜의 ‘95%’는 같은 뜻인가?', check: '①·② 두 애니메이션을 각각 실행, 사전분포를 정규로 바꿔 보기' },
]

const SELF_STUDY = [
  { session: '1차시', path: 'E01 → E02 → E04', topic: '검정에서 구간으로' },
  { session: '2차시', path: 'E03 → E05 → E08', topic: '구간 만들기와 설계' },
  { session: '3차시', path: 'E02·E04 이항 → E06 → E07', topic: '비율과 세 관점' },
  { session: '심화', path: 'E09 → E10 → E11 → E12 → E13 → E14', topic: '가정, 정확성, 두 모집단, 베이즈, CDF 역산, 부트스트랩' },
]

/** 활동지 문항 (각 실험의 ‘예상하기’를 줄인 것). 정답 해설은 인쇄 옵션 */
const WORKSHEET = [
  { exp: 'E01', q: '95% 신뢰구간을 100번 만들면, 참값을 포함하는 구간은 몇 개일까?', a: '대체로 95개 근처지만 매번 다르다. 포함 개수는 Binomial(100, 0.95)를 따른다. (M2)' },
  { exp: 'E01', q: '어떤 연구에서 구한 95% 신뢰구간 [12.1, 15.3]에 μ가 있을 확률은 95%인가?', a: '아니다. 95%는 절차의 반복표집 포함률이다. 관측된 구간은 μ를 포함하거나 포함하지 않는다. (M1)' },
  { exp: 'E02', q: '모든 μ₀에 대해 z 검정의 채택역을 쌓으면 어떤 모양이 되고, 신뢰구간은 어떻게 읽는가?', a: '기울기 1인 평행한 띠. 관측 x̄ 높이에서 가로로 자른 부분이 신뢰구간이다. (M4)' },
  { exp: 'E03', q: '같은 95%에서 꼬리를 1%/4%로 나누면 구간은 어떻게 되는가?', a: '포함률은 같고 위치가 옮겨지며, 대칭 분포에서는 길어진다. 구간은 하나로 정해지지 않는다. (M9)' },
  { exp: 'E04', q: 'μ의 95% 신뢰구간이 [90.2, 109.8]일 때 유의수준 5% 양측 검정으로 H₀: μ = 95를 검정하면?', a: '95가 구간 안에 있으므로 기각하지 않는다. 그렇다고 μ = 95가 증명된 것은 아니다. (M4, M10)' },
  { exp: 'E05', q: 'σ를 아는 z 구간에서 n을 2배로 늘리면 오차한계는?', a: '1/√2 ≈ 0.71배. 절반으로 줄이려면 n을 4배로 늘려야 한다. (M7)' },
  { exp: 'E06', q: 'n = 10에서 Wald 95% 구간의 포함률이 84%인 p가 있다. 구현 오류인가?', a: '아니다. Wald 검정은 크기를 보장하지 않아 작은 n에서 명목수준을 자주 밑돈다. (M6)' },
  { exp: 'E06', q: '사후질량이 95%인 Jeffreys 구간의 포함률이 p = 0.01에서 90.4%다. 모순인가?', a: '아니다. 사후질량과 고정된 p에서의 포함률은 다른 양이다. x = 0일 때만 포함하므로 0.99¹⁰. (M8)' },
  { exp: 'E07', q: '같은 구간 [90.2, 109.8]에 대해 네이만·베이즈·피듀셜의 문장을 각각 쓰라.', a: '네이만: 반복 적용하면 구간의 95%가 참값을 포함한다. 베이즈: 사전·모형·자료 아래 사후질량이 95%다. 피듀셜: 사전 없이 뒤집어 만든 μ*의 분포이며 해석에 논쟁이 있다. (M11)' },
  { exp: 'E08', q: 'μ의 95% 신뢰구간이 새 관측값 하나를 포함할 확률은? (n = 25)', a: '약 30%. 새 관측값을 대상으로 하려면 폭이 √(n+1)배인 예측구간이 필요하다. (M3)' },
  { exp: 'E09', q: '평균·분산을 맞춘 지수 모집단에서 n = 10의 t 구간 포함률은?', a: '약 90%이고, 구간이 참값보다 왼쪽에 있어 놓치는 경우(U < μ)가 대부분이다. (M6)' },
  { exp: 'E12', q: '치우친 사후분포에서 95% 동일꼬리 구간과 HPD는 어떻게 다른가?', a: 'HPD가 더 짧고 최빈값 쪽으로 옮겨 간다. 봉우리가 여럿이면 HPD는 여러 조각이 된다. (M9)' },
]

export function TeachPage() {
  const [hl, setHl] = useState({ mu: 100, sigma: 25, n: 25, level: 0.95 })
  const [link, setLink] = useState('')
  const [msg, setMsg] = useState('')
  const [answers, setAnswers] = useState(false)
  const base = `${location.origin}${location.pathname}`

  const makeLink = () => {
    const p = serializeState({ ...DEFAULTS, ...hl, muc: hl.mu, hm: true, hide: true, seed: randomSeed() })
    const url = `${base}#/lab/e01?${p.toString()}`
    setLink(url)
    navigator.clipboard?.writeText(url).then(
      () => setMsg('복사했습니다.'),
      () => setMsg('아래 주소를 직접 복사하세요.'),
    )
  }

  return (
    <div className="container narrow teach">
      <header className="lab-head no-print">
        <p className="eyebrow">강의자 도구</p>
        <h1>수업에서 쓰는 구간 실험실</h1>
        <p className="desc">
          실험 화면의 <strong>강의 모드</strong>(오른쪽 위)를 켜면 글자가 커지고 단축키(Space 실행, ← → 단계·값 이동, H 참값 숨김/공개)가 켜집니다.
        </p>
      </header>

      <section className="teach-section no-print">
        <h2>75분 강의 경로</h2>
        <ol className="teach-steps">
          {LECTURE.map((st, i) => (
            <li key={i} className="panel">
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <strong>
                  {st.min}분 · {st.title}
                </strong>
                <Link className="btn-outline sm" to={st.to}>
                  {st.exp} 열기
                </Link>
              </div>
              <p>
                <b>질문</b> {st.ask}
              </p>
              <p className="muted">
                <b>확인</b> {st.check}
              </p>
            </li>
          ))}
        </ol>
        <p className="chart-caption">시간은 편성을 위한 제안이며 측정값이 아닙니다(PRD §4.5).</p>
      </section>

      <section className="teach-section no-print">
        <h2>자율학습 경로 (방송대 기본)</h2>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="자율학습 경로 표">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th scope="col">차시</th>
                <th scope="col">경로</th>
                <th scope="col">주제</th>
              </tr>
            </thead>
            <tbody>
              {SELF_STUDY.map((r) => (
                <tr key={r.session}>
                  <th scope="row">{r.session}</th>
                  <td>{r.path}</td>
                  <td>{r.topic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="teach-section no-print">
        <h2>참값 숨김 링크 만들기</h2>
        <p className="desc">학생이 참값을 모른 채 구간을 계산하게 한 뒤, 반복표집으로 참값을 공개하는 수업용입니다. 링크에는 중심값과 seed만 들어가고, 참값은 중심값에서 ±1.5σ 안으로 seed가 정합니다. 보안 기능은 아닙니다.</p>
        <div className="design-pair">
          <div className="settings">
            <SliderField label="참값의 중심 μ" value={hl.mu} min={-1000} max={1000} step={1} onChange={(v) => setHl({ ...hl, mu: v })} />
            <SliderField label="σ" value={hl.sigma} min={0.5} max={100} step={0.5} onChange={(v) => setHl({ ...hl, sigma: v })} />
            <SliderField label="n" value={hl.n} min={2} max={200} step={1} onChange={(v) => setHl({ ...hl, n: v })} />
            <SliderField label="신뢰수준" value={hl.level} min={0.5} max={0.999} step={0.001} onChange={(v) => setHl({ ...hl, level: v })} format={(v) => `${(v * 100).toFixed(1)}%`} />
          </div>
          <div>
            <button type="button" className="btn-filled" onClick={makeLink}>
              E01 숨김 링크 만들기 (새 seed)
            </button>
            <span className="toast" role="status" style={{ marginLeft: 8 }}>
              {msg}
            </span>
            {link && (
              <p className="raw-data" style={{ marginTop: 10 }}>
                {link}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="teach-section worksheet">
        <div className="row no-print" style={{ justifyContent: 'space-between', gap: 8 }}>
          <h2>인쇄용 활동지</h2>
          <div className="row" style={{ gap: 8 }}>
            <label className="row" style={{ gap: 6, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
              답과 해설 포함
            </label>
            <button type="button" className="btn-outline sm" onClick={() => window.print()}>
              인쇄
            </button>
          </div>
        </div>
        <h2 className="print-only">구간추정 활동지 — 구간 실험실</h2>
        <p className="print-only">이름: ____________________ 날짜: ____________</p>
        <ol className="worksheet-list">
          {WORKSHEET.map((w, i) => (
            <li key={i}>
              <span className="badge badge-gray">{w.exp}</span> {w.q}
              {answers ? <p className="worksheet-answer">{w.a}</p> : <div className="worksheet-blank" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <p className="chart-caption">문항은 교재·워크북 문항을 옮기지 않고 같은 개념으로 새로 쓴 것입니다. 괄호 안은 PRD의 오개념 ID입니다. 사이트: {base}</p>
      </section>
    </div>
  )
}
