// E12: 사후밀도, HPD 성분(칠한 영역 + 높이 h 선), 동일꼬리 구간(위쪽 괄호), 추가 비교 괄호
import type { Ref } from 'react'
import type { Dist1D } from '../../engine/bayesSets'
import type { Interval } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'

export interface Bracket {
  iv: Interval
  label: string
  color: string
  dash?: string
}

interface Props {
  dist: Dist1D
  components: Interval[]
  h: number
  brackets: Bracket[]
  xTitle: string
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
  height?: number
}

export function SetDensityChart({ dist, components, h, brackets, xTitle, svgRef, ariaLabel, height = 280 }: Props) {
  const H = height
  const top = 18 + brackets.length * 18
  const m = { l: 24, r: 18, t: top, b: 42 }
  const [d0, d1] = dist.view
  const N = 400
  const inner = (d1 - d0) * 1e-6
  const xs = Array.from({ length: N + 1 }, (_, i) => clamp(d0 + ((d1 - d0) * i) / N, d0 + inner, d1 - inner))
  const ys = xs.map((v) => dist.pdf(v))
  const finite = ys.filter((v) => Number.isFinite(v))
  // U자형처럼 끝에서 무한대로 가는 밀도는 h의 몇 배까지만 그린다
  const yMax = Math.min(Math.max(...finite), Math.max(h * 4, [...finite].sort((a, b) => a - b)[Math.floor(finite.length * 0.9)] * 1.5)) * 1.12
  const { x, y } = makeScales([d0, d1], [0, yMax], H, m)
  const cy = (v: number) => y(clamp(Number.isFinite(v) ? v : yMax, 0, yMax))
  const curve = xs.map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${cy(ys[i]).toFixed(1)}`).join('')
  const area = (c: Interval) => {
    const a = clamp(c.lower, d0 + inner, d1 - inner)
    const b = clamp(c.upper, d0 + inner, d1 - inner)
    const pts = Array.from({ length: 121 }, (_, i) => a + ((b - a) * i) / 120)
    return `M${x(a).toFixed(1)},${y(0).toFixed(1)}` + pts.map((v) => `L${x(v).toFixed(1)},${cy(dist.pdf(v)).toFixed(1)}`).join('') + `L${x(b).toFixed(1)},${y(0).toFixed(1)}Z`
  }
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={[d0, d1]} yDomain={[0, yMax]} H={H} m={m} xTitle={xTitle} yTicks={[]} grid={false} />
      {components.map((c, i) => (
        <path key={i} d={area(c)} fill="var(--c-pval-fill)" stroke="none" />
      ))}
      <path d={curve} fill="none" stroke="var(--c-pval)" strokeWidth={2} />
      <line x1={m.l} x2={W - m.r} y1={cy(h)} y2={cy(h)} stroke="var(--c-pval)" strokeWidth={1.2} strokeDasharray="5 4" />
      <text x={W - m.r - 4} y={cy(h) - 5} textAnchor="end" fontSize={11} fill="var(--c-pval)" fontWeight={600}>
        높이 h = {h.toPrecision(4)} (HPD: 밀도 ≥ h)
      </text>
      {components.map((c, i) =>
        [c.lower, c.upper].map((e, j) =>
          e > d0 + inner && e < d1 - inner ? <circle key={`${i}${j}`} cx={x(e)} cy={cy(h)} r={4} fill="var(--c-pval)" stroke="#fff" strokeWidth={1.2} /> : null,
        ),
      )}
      {brackets.map((br, i) => {
        const yy = 12 + i * 18
        const a = x(clamp(br.iv.lower, d0, d1))
        const b = x(clamp(br.iv.upper, d0, d1))
        return (
          <g key={br.label}>
            <line x1={a} x2={b} y1={yy} y2={yy} stroke={br.color} strokeWidth={2.2} strokeDasharray={br.dash} />
            <line x1={a} x2={a} y1={yy - 5} y2={yy + 5} stroke={br.color} strokeWidth={2} />
            <line x1={b} x2={b} y1={yy - 5} y2={yy + 5} stroke={br.color} strokeWidth={2} />
            <text x={b + 6 > W - 150 ? a - 6 : b + 6} y={yy + 4} textAnchor={b + 6 > W - 150 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={br.color}>
              {br.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
