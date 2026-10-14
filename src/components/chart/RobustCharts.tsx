// E09 그림: 모집단 밀도(같은 평균·분산의 정규와 비교), 표본크기별 포함률
import type { Ref } from 'react'
import { standardPdf, type Population } from '../../engine/robust'
import { Axes, W, clamp, makeScales } from './frame'

export function PopDensityChart({ pop, mu, sigma, ariaLabel }: { pop: Population; mu: number; sigma: number; ariaLabel: string }) {
  const H = 180
  const m = { l: 18, r: 16, t: 14, b: 40 }
  const zd: [number, number] = [-3.5, 5]
  const N = 300
  const zs = Array.from({ length: N + 1 }, (_, i) => zd[0] + ((zd[1] - zd[0]) * i) / N)
  const f = zs.map((z) => standardPdf(pop, z))
  const g = zs.map((z) => standardPdf('normal', z))
  const yMax = Math.min(1.2, Math.max(...f, ...g)) * 1.1
  const domain: [number, number] = [mu + sigma * zd[0], mu + sigma * zd[1]]
  const { x, y } = makeScales(domain, [0, yMax / sigma], H, m)
  const path = (vals: number[]) => zs.map((z, i) => `${i ? 'L' : 'M'}${x(mu + sigma * z).toFixed(1)},${y(clamp(vals[i], 0, yMax) / sigma).toFixed(1)}`).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, yMax / sigma]} H={H} m={m} xTitle="관측값 X" yTicks={[]} grid={false} />
      <path d={path(g)} fill="none" stroke="var(--c-text-tertiary)" strokeWidth={1.4} strokeDasharray="5 4" />
      <path d={path(f)} fill="var(--c-cover-fill)" stroke="var(--c-cover)" strokeWidth={2} />
      <line x1={x(mu)} x2={x(mu)} y1={m.t} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={1.6} />
      <text x={x(mu) + 5} y={m.t + 10} fontSize={11} fontWeight={600} fill="var(--c-truth)">
        μ = {mu}
      </text>
    </svg>
  )
}

export interface CovSeries {
  label: string
  color: string
  dash?: string
  points: { n: number; c: number; se: number }[]
}

export function CoverageByNChart({ series, level, mark, svgRef, ariaLabel }: { series: CovSeries[]; level: number; mark: number; svgRef?: Ref<SVGSVGElement>; ariaLabel: string }) {
  const H = 260
  const m = { l: 66, r: 16, t: 14, b: 42 }
  const all = series.flatMap((s) => s.points.map((p) => p.c))
  const lo = Math.max(0, Math.min(level - 0.1, ...all) - 0.02)
  const nLo = 4
  const nHi = 250
  const lx = (n: number) => Math.log10(n)
  const { x, y } = makeScales([lx(nLo), lx(nHi)], [lo, 1], H, m)
  const ticks = [5, 10, 20, 50, 100, 200]
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={[lx(nLo), lx(nHi)]} yDomain={[lo, 1]} H={H} m={m} xTitle="표본크기 n (로그 눈금)" yTitle="포함률 (MC)" xTicks={ticks.map(lx)} xFormat={(t) => String(Math.round(10 ** t))} yFormat={(v) => `${Math.round(v * 100)}%`} />
      <line x1={m.l} x2={W - m.r} y1={y(level)} y2={y(level)} stroke="var(--c-truth)" strokeDasharray="5 4" strokeWidth={1.2} />
      <text x={W - m.r - 4} y={y(level) - 5} textAnchor="end" fontSize={11} fill="var(--c-truth)">
        명목수준 {Math.round(level * 1000) / 10}%
      </text>
      <line x1={x(lx(clamp(mark, nLo, nHi)))} x2={x(lx(clamp(mark, nLo, nHi)))} y1={m.t} y2={H - m.b} stroke="var(--c-mu0)" strokeWidth={1.2} strokeDasharray="3 3" />
      {series.map((s) => (
        <g key={s.label}>
          <path d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(lx(p.n)).toFixed(1)},${y(clamp(p.c, lo, 1)).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
          {s.points.map((p) => (
            <g key={p.n}>
              <line x1={x(lx(p.n))} x2={x(lx(p.n))} y1={y(clamp(p.c - 2 * p.se, lo, 1))} y2={y(clamp(p.c + 2 * p.se, lo, 1))} stroke={s.color} strokeWidth={1.2} />
              <circle cx={x(lx(p.n))} cy={y(clamp(p.c, lo, 1))} r={3.2} fill={s.color} stroke="#fff" strokeWidth={1} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}
