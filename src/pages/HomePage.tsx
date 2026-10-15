import { Link } from 'react-router-dom'
import { EXPERIMENTS } from '../components/lab'
import { clearLog, readLog } from '../lib/learningLog'
import { buildPilotExport } from '../lib/pilot'
import { clearVisits } from '../lib/visits'
import { downloadText } from '../lib/download'
import { useState } from 'react'

const HYPOTHESIS_LAB = 'https://databetter25.github.io/hypothesis-lab/'

export function HomePage() {
  const [logCount, setLogCount] = useState(() => readLog().length)
  const [pid, setPid] = useState('')
  return (
    <>
      <section className="hero">
        <div className="container narrow">
          <p className="eyebrow hero-el">통계학의 개념 및 제문제 · 제8장 구간추정</p>
          <h1 className="hero-title hero-el">
            신뢰구간은 <span className="grad-text">뒤집은 검정</span>이다
          </h1>
          <p className="hero-q hero-el">7장에서 배운 검정의 채택역을 모든 모수값에 대해 모으면 신뢰띠가 되고, 관측값에서 띠를 자르면 신뢰구간이 됩니다. 반복표집, 신뢰띠, p-값 함수로 직접 확인해 보세요.</p>
          <div className="btn-row hero-el">
            <Link className="btn-filled lg" to="/lab/e01">
              E01부터 시작하기
            </Link>
            <a className="btn-ghost" href={HYPOTHESIS_LAB} target="_blank" rel="noreferrer">
              7장 복습: 검정 실험실 ↗
            </a>
          </div>
        </div>
      </section>

      <section className="section alt" id="experiments">
        <div className="container">
          <p className="eyebrow">01 — 추천 경로와 전체 실험</p>
          <h2 className="section-title">검정에서 구간으로</h2>
          <p className="desc">1차시(30–40분): E01 → E02 → E04 · 2차시: E03 → E05 → E08 · 3차시: E02·E04의 이항 모형 → E06 → E07 · 심화: E09–E13</p>
          {(['P0', 'P1', 'P2'] as const).map((tier) => (
            <div key={tier} style={{ marginTop: 24 }}>
              <h3 className="chart-title">{tier === 'P0' ? '핵심 (P0) — 교재 8장의 중심' : tier === 'P1' ? '심화 (P1) — 가정, 정확성, 두 모집단, 베이즈, CDF 역산' : '확장 (P2) — 교재 밖 방법'}</h3>
              <div className="card-grid">
                {EXPERIMENTS.filter((e) => e.tier === tier).map((e) => (
                  <Link key={e.id} to={`/lab/${e.id}`} className="feat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className={`badge ${tier === 'P0' ? 'badge-blue' : 'badge-gray'}`}>{e.code}</span>
                    <h3 style={{ marginTop: 12 }}>{e.title}</h3>
                    <p>{e.short}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container narrow">
          <p className="eyebrow">02 — 핵심 아이디어</p>
          <h2 className="section-title">검정의 언어와 구간의 언어</h2>
          <table className="idea-table">
            <thead>
              <tr>
                <th scope="col">검정의 언어</th>
                <th scope="col">구간의 언어</th>
                <th scope="col">확인하는 곳</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>H₀: θ = θ₀를 기각하지 않는다</td>
                <td>θ₀ ∈ C(x)</td>
                <td>E02, E04</td>
              </tr>
              <tr>
                <td>θ에서의 제1종 오류율</td>
                <td>1 − 포함률 P_θ{'{'}θ ∈ C(X){'}'}</td>
                <td>E01, E02 4단계</td>
              </tr>
              <tr>
                <td>θ′에 대한 검정의 θ에서의 검정력</td>
                <td>1 − 오포함확률 P_θ{'{'}θ′ ∈ C(X){'}'}</td>
                <td>E10</td>
              </tr>
            </tbody>
          </table>
          <div className="note">
            <strong>이 사이트의 약속</strong> — 참값은 교육용으로 정한 생성 조건이며 그림에서 움직이지 않습니다. ‘95%’는 절차를 반복할 때의 포함 비율이지, 이미 구한 구간 하나에 모수가 있을 확률이 아닙니다.
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container narrow">
          <p className="eyebrow">03 — 내 학습기록</p>
          <h2 className="section-title">예상과 결과</h2>
          <p className="desc">
            시작하기 전에 <Link to="/learn/diagnose">사전 진단</Link>(12문항)을 풀고, 학습을 마친 뒤 사후 진단으로 변화를 확인해 보세요. 헷갈리는 표현은 <Link to="/learn/guide">용어·해석</Link>, 구간 방법의 비교는 <Link to="/learn/methods">방법 카탈로그</Link>에 정리되어 있습니다.
          </p>
          <p className="desc">
            실험의 ‘예상하기’와 진단 기록 {logCount}건이 이 브라우저에만 저장되어 있습니다. 서버로는 아무것도 보내지 않습니다. 파일럿에 참여한다면 아래에서 내보내 직접 제출하세요.
          </p>
          <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn-outline" disabled={!logCount} onClick={() => downloadText(JSON.stringify(readLog(), null, 2), 'interval-lab-learning-log.json', 'application/json')}>
              학습기록 JSON 내보내기
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!logCount}
              onClick={() => {
                if (confirm('이 브라우저의 학습기록을 모두 지울까요?')) {
                  clearLog()
                  clearVisits()
                  setLogCount(0)
                }
              }}
            >
              기록 지우기
            </button>
          </div>
          <div className="panel pilot-box">
            <h3 className="chart-title" style={{ marginTop: 0 }}>
              파일럿 참여자: 제출 파일 만들기
            </h3>
            <p className="desc" style={{ margin: '4px 0 10px' }}>
              사전·사후 진단 결과, 예상하기 기록, 연 실험 목록을 한 파일로 내보냅니다. 이름 대신 안내받은 참가 번호만 적으세요. 파일은 이 컴퓨터에 저장되며, 제출은 동의한 경우에만 직접 합니다.
            </p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <label className="row" style={{ gap: 6 }}>
                참가 번호
                <input className="num-input" style={{ width: 120 }} value={pid} onChange={(e) => setPid(e.target.value.replace(/[^\w-]/g, '').slice(0, 20))} placeholder="예: P07" />
              </label>
              <button
                type="button"
                className="btn-filled sm"
                disabled={!pid}
                onClick={() => downloadText(JSON.stringify(buildPilotExport(pid), null, 2), `interval-lab-pilot-${pid}.json`, 'application/json')}
              >
                제출 파일 내보내기
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
