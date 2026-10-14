// E03: 피벗 분포와 두 꼬리 (왼쪽 α_L, 오른쪽 α_U), 분위수 Q_{α_L}, Q_{1−α_U}
import { useId, type Ref } from 'react'
import type { PivotDist } from '../../engine/pivot'
import { Axes, HatchDef, W, clamp, makeScales } from './frame'

interface Props {
  dist: PivotDist
  aL: number
  aU: number
  xTitle: string
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

const pctLabel = (a: number) => `${Math.round(a * 10000) / 100}%`

export function PivotDensityChart({ dist, aL, aU, xTitle, svgRef, ariaLabel }: Props) {
  const H = 230
  const m = { l: 24, r: 20, t: 24, b: 44 }
  const [d0, d1] = dist.domain
  const N = 300
  const xs = Array.from({ length: N + 1 }, (_, i) => d0 + ((d1 - d0) * i) / N)
  const ys = xs.map((v) => dist.pdf(v))
  const yMax = Math.min(Math.max(...ys.filter(Number.isFinite)), 3) * 1.18
  const { x, y } = makeScales([d0, d1], [0, yMax], H, m)
  const cy = (v: number) => y(clamp(Number.isFinite(v) ? v : yMax, 0, yMax))
  const hatch = useId().replace(/:/g, '')
  const qL = dist.ppf(aL)
  const qU = dist.ppf(1 - aU)
  const area = (a: number, b: number) => {
    const lo = clamp(a, d0, d1)
    const hi = clamp(b, d0, d1)
    if (hi <= lo) return ''
    const pts = Array.from({ length: 81 }, (_, i) => lo + ((hi - lo) * i) / 80)
    return `M${x(lo).toFixed(1)},${y(0).toFixed(1)}` + pts.map((v) => `L${x(v).toFixed(1)},${cy(dist.pdf(v)).toFixed(1)}`).join('') + `L${x(hi).toFixed(1)},${y(0).toFixed(1)}Z`
  }
  const curve = xs.map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${cy(ys[i]).toFixed(1)}`).join('')
  const midLo = Number.isFinite(qL) ? qL : d0
  const midHi = Number.isFinite(qU) ? qU : d1
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <HatchDef id={hatch} color="var(--c-reject)" />
      <Axes x={x} y={y} xDomain={[d0, d1]} yDomain={[0, yMax]} H={H} m={m} xTitle={xTitle} yTicks={[]} grid={false} />
      <path d={area(midLo, midHi)} fill="var(--c-cover-fill)" />
      {aL > 0 && <path d={area(d0, qL)} fill={`url(#${hatch})`} stroke="var(--c-reject)" strokeWidth={0.8} />}
      {aU > 0 && <path d={area(qU, d1)} fill={`url(#${hatch})`} stroke="var(--c-reject)" strokeWidth={0.8} />}
      <path d={curve} fill="none" stroke="var(--c-cover)" strokeWidth={2} />
      <text x={(x(clamp(midLo, d0, d1)) + x(clamp(midHi, d0, d1))) / 2} y={m.t + 14} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--c-cover)">
        {pctLabel(1 - aL - aU)}
      </text>
      {[
        { q: qL, a: aL, side: 'L' },
        { q: qU, a: aU, side: 'U' },
      ].map((t) =>
        t.a > 0 && Number.isFinite(t.q) ? (
          <g key={t.side}>
            <line x1={x(clamp(t.q, d0, d1))} x2={x(clamp(t.q, d0, d1))} y1={m.t - 4} y2={y(0)} stroke="var(--c-truth)" strokeWidth={1.4} />
            <text x={x(clamp(t.q, d0, d1)) + (t.side === 'L' ? -5 : 5)} y={m.t - 8} textAnchor={t.side === 'L' ? 'end' : 'start'} fontSize={11} fontWeight={600} fill="var(--c-truth)">
              {t.side === 'L' ? `Q(α_L) = ${t.q.toFixed(4)}` : `Q(1−α_U) = ${t.q.toFixed(4)}`}
            </text>
            <text x={x(clamp(t.q, d0, d1)) + (t.side === 'L' ? -6 : 6)} y={y(0) - 8} textAnchor={t.side === 'L' ? 'end' : 'start'} fontSize={11} fill="var(--c-reject)" fontWeight={600}>
              {t.side === 'L' ? `α_L = ${pctLabel(t.a)}` : `α_U = ${pctLabel(t.a)}`}
            </text>
          </g>
        ) : null,
      )}
    </svg>
  )
}
