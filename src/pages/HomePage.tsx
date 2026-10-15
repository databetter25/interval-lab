import { Link } from 'react-router-dom'
import { EXPERIMENTS } from '../components/lab'
import { clearLog, readLog } from '../lib/learningLog'
import { downloadText } from '../lib/download'
import { useState } from 'react'

const HYPOTHESIS_LAB = 'https://databetter25.github.io/hypothesis-lab/'

export function HomePage() {
  const [logCount, setLogCount] = useState(() => readLog().length)
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
            실험의 ‘예상하기’ 기록 {logCount}건이 이 브라우저에만 저장되어 있습니다. 서버로는 아무것도 보내지 않습니다. 파일럿에 참여한다면 아래에서 내보내 직접 제출하세요.
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
                  setLogCount(0)
                }
              }}
            >
              기록 지우기
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
