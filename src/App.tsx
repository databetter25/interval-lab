import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { PresentContext } from './lib/present'

const LabPage = lazy(() => import('./pages/LabPage').then((m) => ({ default: m.LabPage })))

function NotFound() {
  return (
    <div className="container narrow" style={{ padding: '120px 24px' }}>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="desc">
        주소를 확인해 주세요. <Link to="/">처음으로</Link>
      </p>
    </div>
  )
}

export default function App() {
  const [present, setPresent] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    document.body.classList.toggle('present', present)
  }, [present])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  return (
    <PresentContext.Provider value={present}>
      <a className="sr-only" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="nav-brand">
            <img src="./favicon.svg" alt="" />
            구간 실험실
          </NavLink>
          <nav className="nav-links" aria-label="주 메뉴">
            {[
              ['e01', '반복표집'],
              ['e02', '신뢰띠'],
              ['e04', '검정 역산'],
              ['e06', '이항구간'],
              ['e07', '세 관점'],
            ].map(([id, label]) => (
              <NavLink key={id} to={`/lab/${id}${loc.pathname.startsWith('/lab') ? loc.search : ''}`}>
                {label}
              </NavLink>
            ))}
            <NavLink to="/" end>
              전체 실험
            </NavLink>
          </nav>
          <div className="nav-tools">
            <button className="btn-outline sm" aria-pressed={present} onClick={() => setPresent(!present)} title="글자를 키우고 단축키를 켭니다">
              강의 모드
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <Suspense fallback={<div className="page-loading" role="status">불러오는 중…</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/lab/:id" element={<LabPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="footer">
        <div className="container">
          구간 실험실 (MVP-α) · 『통계학의 개념 및 제문제』 제8장 연계 학습 도구 · 교재 본문·그림은 싣지 않고 수치 설정만 재현합니다 · 모든 계산은 브라우저에서 수행되며 어떤 데이터도 서버로 보내지 않습니다.
        </div>
      </footer>
    </PresentContext.Provider>
  )
}
