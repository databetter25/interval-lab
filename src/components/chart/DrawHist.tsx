// E07 사후표집(또는 μ* 표집): 관측 자료는 고정, 뽑히는 것은 모수 쪽 값. 구간 안 표본은 채운 막대
import type { Ref } from 'react'
import { normPdf } from '../../engine/core/normal'
import type { Interval } from '../../engine/meanInterval'
import type { NormalDist } from '../../engine/threeViews'
import { Axes, W, makeScales } from './frame'

interface Props {
  draws: Float64Array
  dist: NormalDist
  interval: Interval
  domain: [number, number]
  observed: number
  symbol: string
  color: string
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

const BINS = 48

export function DrawHist({ draws, dist, interval, domain, observed, symbol, color, svgRef, ariaLabel }: Props) {
  const H = 250
  const m = { l: 40, r: 16, t: 26, b: 42 }
  const width = (domain[1] - domain[0]) / BINS
  const counts = new Array<number>(BINS).fill(0)
  for (const v of draws) {
    const i = Math.floor((v - domain[0]) / width)
    if (i >= 0 && i < BINS) counts[i]++
  }
  const dens = counts.map((c) => (draws.length ? c / (draws.length * width) : 0))
  const sd = Math.sqrt(dist.variance)
  const peak = normPdf(0) / sd
  const yMax = Math.max(peak, ...dens) * 1.15
  const { x, y } = makeScales(domain, [0, yMax], H, m)
  const N = 160
  const curve = Array.from({ length: N + 1 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / N)
    .map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(normPdf((v - dist.mean) / sd) / sd).toFixed(1)}`)
    .join('')
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, yMax]} H={H} m={m} xTitle={`${symbol} (뽑히는 것은 모수 쪽 값)`} yTicks={[]} grid={false} />
      {dens.map((d, i) => {
        const a = domain[0] + i * width
        const mid = a + width / 2
        const inside = interval.lower <= mid && mid <= interval.upper
        return d > 0 ? <rect key={i} x={x(a) + 0.5} width={Math.max(1, x(a + width) - x(a) - 1)} y={y(d)} height={y(0) - y(d)} fill={inside ? color : 'none'} opacity={inside ? 0.35 : 1} stroke={color} strokeWidth={0.8} /> : null
      })}
      <path d={curve} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray="5 3" />
      {[interval.lower, interval.upper].map((v) => (
        <line key={v} x1={x(v)} x2={x(v)} y1={m.t} y2={y(0)} stroke="var(--c-obs)" strokeWidth={1.2} strokeDasharray="3 3" />
      ))}
      <line x1={x(observed)} x2={x(observed)} y1={m.t - 6} y2={y(0)} stroke="var(--c-truth)" strokeWidth={2.2} />
      <text x={x(observed)} y={m.t - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--c-truth)">
        관측 x̄ = {observed} (고정)
      </text>
      {draws.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--c-text-tertiary)">
          아직 뽑은 {symbol}가 없습니다. 위의 버튼을 눌러 보세요.
        </text>
      )}
    </svg>
  )
}
