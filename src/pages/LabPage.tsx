import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { EXPERIMENTS, LabTabs } from '../components/lab'
import { useLabState, type LabState, type Update } from '../state/labState'

type Exp = ComponentType<{ s: LabState; update: Update }>
// 실험마다 따로 불러온다 (첫 화면과 다른 실험의 코드를 나눈다)
const named = (load: () => Promise<Record<string, unknown>>, name: string) => lazy(() => load().then((m) => ({ default: m[name] as Exp })))
const PAGES: Record<string, Exp> = {
  e01: named(() => import('../experiments/E01'), 'E01'),
  e02: named(() => import('../experiments/E02'), 'E02'),
  e03: named(() => import('../experiments/E03'), 'E03'),
  e04: named(() => import('../experiments/E04'), 'E04'),
  e05: named(() => import('../experiments/E05'), 'E05'),
  e06: named(() => import('../experiments/E06'), 'E06'),
  e07: named(() => import('../experiments/E07'), 'E07'),
  e08: named(() => import('../experiments/E08'), 'E08'),
  e09: named(() => import('../experiments/E09'), 'E09'),
  e10: named(() => import('../experiments/E10'), 'E10'),
  e11: named(() => import('../experiments/E11'), 'E11'),
  e12: named(() => import('../experiments/E12'), 'E12'),
  e13: named(() => import('../experiments/E13'), 'E13'),
}

export function LabPage() {
  const { id = 'e01' } = useParams()
  const [s, update] = useLabState()
  const meta = EXPERIMENTS.find((e) => e.id === id)
  if (!meta) return <Navigate to="/lab/e01" replace />
  const Page = PAGES[id]
  return (
    <div className="container wide">
      <header className="lab-head">
        <p className="eyebrow">
          {meta.code} — {meta.short}
        </p>
        <h1>{meta.title}</h1>
        <LabTabs current={id} />
      </header>
      <Suspense fallback={<div className="page-loading" role="status">실험을 불러오는 중…</div>}>
        <Page s={s} update={update} />
      </Suspense>
    </div>
  )
}
