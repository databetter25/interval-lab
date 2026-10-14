// 이항 구간의 정확 포함률 함수 c(p) (전수 합). 격자 p = 0.002, 0.004, …, 0.998
import { useMemo } from 'react'
import { binomCoverage } from '../../engine/binomial'
import type { Interval } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'

interface Props {
  n: number
  level: number
  belt: Interval[]
  mark: number
  ariaLabel: string
}

const GRID = Array.from({ length: 499 }, (_, i) => (i + 1) / 500)

export function CoverageCurve({ n, level, belt, mark, ariaLabel }: Props) {
  const H = 210
  const m = { l: 66, r: 16, t: 12, b: 40 }
  const cs = useMemo(() => GRID.map((p) => binomCoverage(n, p, belt)), [n, belt])
  const lo = Math.max(0, Math.min(level - 0.15, ...cs))
  const { x, y } = makeScales([0, 1], [lo, 1], H, m)
  const path = GRID.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(clamp(cs[i], lo, 1)).toFixed(1)}`).join('')
  const cMark = binomCoverage(n, mark, belt)
  const gridMin = Math.min(...cs)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <Axes x={x} y={y} xDomain={[0, 1]} yDomain={[lo, 1]} H={H} m={m} xTitle="참값 p" yTitle="포함률 c(p)" xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]} yFormat={(v) => `${Math.round(v * 100)}%`} />
        <line x1={m.l} x2={W - m.r} y1={y(level)} y2={y(level)} stroke="var(--c-truth)" strokeDasharray="5 4" strokeWidth={1.2} />
        <text x={m.l + 6} y={y(level) + 14} fontSize={11} fill="var(--c-truth)">
          명목수준 {Math.round(level * 1000) / 10}%
        </text>
        <path d={path} fill="none" stroke="var(--c-cover)" strokeWidth={1.4} />
        <line x1={x(mark)} x2={x(mark)} y1={m.t} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={1.4} />
        <circle cx={x(mark)} cy={y(clamp(cMark, lo, 1))} r={4.5} fill="var(--c-cover)" stroke="#fff" strokeWidth={1.5} />
      </svg>
      <p className="chart-caption">
        격자 499점(p = 0.002 간격)의 최솟값 {(gridMin * 100).toFixed(2)}% — 격자 최솟값이며, 모든 p에 대한 하한을 뜻하지는 않습니다.
      </p>
    </>
  )
}
