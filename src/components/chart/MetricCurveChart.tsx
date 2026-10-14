// E06 성능 곡선: 방법마다 c(p)(또는 평균 길이·좌우 비포함)를 겹쳐 그린다.
// 정확값은 선, 시뮬레이션 추정은 p*의 점과 ±2 MC 표준오차 막대. 그림을 누르면 p*가 그 위치로 간다.
import type { Ref } from 'react'
import type { Curves } from '../../engine/binomCompare'
import { Axes, W, clamp, makeScales } from './frame'

export type Metric = 'coverage' | 'meanLength' | 'missLeft' | 'missRight'

export const METRIC_LABEL: Record<Metric, string> = {
  coverage: '포함률 c(p)',
  meanLength: '평균 길이 E[U − L]',
  missLeft: '좌측 비포함 P(L > p)',
  missRight: '우측 비포함 P(U < p)',
}

export interface CurveSeries {
  id: string
  label: string
  color: string
  dash?: string
  curves: Curves
  /** p*에서의 시뮬레이션 추정 (해당 지표가 비율일 때만) */
  mc?: { value: number; se: number }
}

interface Props {
  series: CurveSeries[]
  metric: Metric
  level: number
  mark: number
  onPick: (p: number) => void
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

export function MetricCurveChart({ series, metric, level, mark, onPick, svgRef, ariaLabel }: Props) {
  const H = 320
  const m = { l: 66, r: 16, t: 14, b: 42 }
  const all = series.flatMap((s) => Array.from(s.curves[metric]))
  let yDomain: [number, number]
  if (metric === 'coverage') yDomain = [Math.max(0, Math.min(level - 0.2, ...all.filter((v) => v > level - 0.4))), 1]
  else if (metric === 'meanLength') yDomain = [0, Math.max(0.05, ...all) * 1.08]
  else yDomain = [0, Math.max((1 - level) * 1.6, Math.min(1, Math.max(...all) * 1.08))]
  const { x, y } = makeScales([0, 1], yDomain, H, m)
  const cy = (v: number) => y(clamp(v, yDomain[0], yDomain[1]))
  const pct = metric !== 'meanLength'
  const ref = metric === 'coverage' ? level : metric === 'meanLength' ? null : (1 - level) / 2

  const clipped = all.some((v) => v < yDomain[0])
  return (
    <>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      style={{ cursor: 'crosshair' }}
      onClick={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const vx = ((e.clientX - r.left) / r.width) * W
        const p = clamp(x.invert(vx), 0.001, 0.999)
        onPick(Math.round(p * 1000) / 1000)
      }}
    >
      <Axes x={x} y={y} xDomain={[0, 1]} yDomain={yDomain} H={H} m={m} xTitle="참값 p (그림을 누르면 p* 이동)" yTitle={METRIC_LABEL[metric]} xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]} yFormat={(v) => (pct ? `${Math.round(v * 1000) / 10}%` : v.toFixed(2))} />
      {ref !== null && (
        <g>
          <line x1={m.l} x2={W - m.r} y1={cy(ref)} y2={cy(ref)} stroke="var(--c-truth)" strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={m.l + 6} y={cy(ref) + (metric === 'coverage' ? 14 : -5)} fontSize={11} fill="var(--c-truth)">
            {metric === 'coverage' ? `명목수준 ${Math.round(level * 1000) / 10}%` : `α/2 = ${Math.round(((1 - level) / 2) * 10000) / 100}%`}
          </text>
        </g>
      )}
      {series.map((s) => {
        const g = s.curves.grid
        const v = s.curves[metric]
        let d = ''
        for (let i = 0; i < g.length; i++) d += `${i ? 'L' : 'M'}${x(g[i]).toFixed(1)},${cy(v[i]).toFixed(1)}`
        return <path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth={1.5} strokeDasharray={s.dash} />
      })}
      <line x1={x(mark)} x2={x(mark)} y1={m.t} y2={H - m.b} stroke="var(--c-mu0)" strokeWidth={1.4} />
      <text x={x(mark) > W - 120 ? x(mark) - 6 : x(mark) + 6} y={m.t + 10} textAnchor={x(mark) > W - 120 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill="var(--c-mu0)">
        p* = {mark}
      </text>
      {series.map((s, i) =>
        s.mc ? (
          <g key={`mc${s.id}`}>
            <line x1={x(mark) + 4 + i * 5} x2={x(mark) + 4 + i * 5} y1={cy(s.mc.value - 2 * s.mc.se)} y2={cy(s.mc.value + 2 * s.mc.se)} stroke={s.color} strokeWidth={1.5} />
            <rect x={x(mark) + 1.5 + i * 5} y={cy(s.mc.value) - 2.5} width={5} height={5} fill={s.color} stroke="#fff" strokeWidth={0.8} />
          </g>
        ) : null,
      )}
    </svg>
    {clipped && <p className="chart-caption">세로축 아래({Math.round(yDomain[0] * 100)}%)로 내려간 값은 아래 끝에 붙여 그렸습니다. 정확한 값은 아래 표와 곡선 CSV에 있습니다.</p>}
    </>
  )
}
