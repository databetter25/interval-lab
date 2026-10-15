// E14: 재표집분포(막대)와 표본분포(선)를 같은 축에. 참값 θ와 관측값 θ̂, 세 구간 괄호
import type { Ref } from 'react'
import type { Interval } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'
import type { Bracket } from './SetDensityChart'

interface Props {
  boot: ArrayLike<number>
  sampling: ArrayLike<number>
  theta: number
  thetaHat: number
  brackets: (Bracket & { iv: Interval })[]
  xTitle: string
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

const BINS = 50

function hist(v: ArrayLike<number>, lo: number, w: number) {
  const c = new Array<number>(BINS).fill(0)
  for (let i = 0; i < v.length; i++) {
    const k = Math.floor((v[i] - lo) / w)
    if (k >= 0 && k < BINS) c[k]++
  }
  return c.map((x) => x / (v.length * w))
}

export function BootHistChart({ boot, sampling, theta, thetaHat, brackets, xTitle, svgRef, ariaLabel }: Props) {
  const H = 300
  const top = 16 + brackets.length * 18
  const m = { l: 24, r: 16, t: top, b: 42 }
  const all = [...Array.from(boot), ...Array.from(sampling)].sort((a, b) => a - b)
  const lo = all[Math.floor(all.length * 0.002)]
  const hi = all[Math.floor(all.length * 0.998)]
  const pad = (hi - lo) * 0.08
  const d0 = Math.min(lo - pad, theta, thetaHat)
  const d1 = Math.max(hi + pad, theta, thetaHat)
  const w = (d1 - d0) / BINS
  const hb = hist(boot, d0, w)
  const hs = hist(sampling, d0, w)
  const yMax = Math.max(...hb, ...hs) * 1.12 || 1
  const { x, y } = makeScales([d0, d1], [0, yMax], H, m)
  const line = hs.map((v, i) => `${i ? 'L' : 'M'}${x(d0 + (i + 0.5) * w).toFixed(1)},${y(v).toFixed(1)}`).join('')
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={[d0, d1]} yDomain={[0, yMax]} H={H} m={m} xTitle={xTitle} yTicks={[]} grid={false} />
      {hb.map((v, i) => (v > 0 ? <rect key={i} x={x(d0 + i * w) + 0.5} width={Math.max(1, x(d0 + (i + 1) * w) - x(d0 + i * w) - 1)} y={y(v)} height={y(0) - y(v)} fill="var(--c-pval-fill)" stroke="var(--c-pval)" strokeWidth={0.5} /> : null))}
      <path d={line} fill="none" stroke="var(--c-truth)" strokeWidth={2} strokeDasharray="5 3" />
      <line x1={x(theta)} x2={x(theta)} y1={m.t} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={2.2} />
      <text x={x(theta) + 5} y={H - m.b - 8} fontSize={11} fontWeight={600} fill="var(--c-truth)">
        참값 θ
      </text>
      <line x1={x(thetaHat)} x2={x(thetaHat)} y1={m.t} y2={H - m.b} stroke="var(--c-pval)" strokeWidth={2} strokeDasharray="2 2" />
      <text x={x(thetaHat) + 5} y={m.t + 12} fontSize={11} fontWeight={600} fill="var(--c-pval)">
        관측 θ̂
      </text>
      {brackets.map((br, i) => {
        const yy = 10 + i * 18
        const a = x(clamp(br.iv.lower, d0, d1))
        const b = x(clamp(br.iv.upper, d0, d1))
        return (
          <g key={br.label}>
            <line x1={a} x2={b} y1={yy} y2={yy} stroke={br.color} strokeWidth={2.2} strokeDasharray={br.dash} />
            <line x1={a} x2={a} y1={yy - 5} y2={yy + 5} stroke={br.color} strokeWidth={2} />
            <line x1={b} x2={b} y1={yy - 5} y2={yy + 5} stroke={br.color} strokeWidth={2} />
            <text x={b + 6 > W - 140 ? a - 6 : b + 6} y={yy + 4} textAnchor={b + 6 > W - 140 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={br.color}>
              {br.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
