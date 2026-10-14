// E04 p-값 함수: p(μ₀)와 높이 α의 수평선이 만나는 점 = 신뢰구간의 끝점
import type { Ref } from 'react'
import { meanInterval, meanTest, type Alt } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'

interface Props {
  xbar: number
  sigma: number
  n: number
  level: number
  alt: Alt
  mu0: number
  domain: [number, number]
  nested: boolean
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

export const NESTED_LEVELS = [0.5, 0.8, 0.9, 0.95, 0.99]

export function PFunctionChart({ xbar, sigma, n, level, alt, mu0, domain, nested, svgRef, ariaLabel }: Props) {
  const H = 260
  const m = { l: 66, r: 16, t: 14, b: 40 }
  const { x, y } = makeScales(domain, [0, 1], H, m)
  const a = 1 - level
  const N = 320
  const curve = Array.from({ length: N + 1 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / N)
    .map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(meanTest('z', xbar, sigma, n, t, alt).p).toFixed(1)}`)
    .join('')
  const ci = meanInterval('z', xbar, sigma, n, level, alt)
  const p0 = meanTest('z', xbar, sigma, n, mu0, alt).p
  const cx = (v: number) => x(clamp(v, domain[0], domain[1]))
  const ends = [ci.lower, ci.upper].filter((v) => Number.isFinite(v))

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, 1]} H={H} m={m} xTitle="가설값 μ₀" yTitle="p-값" yTicks={[0, 0.25, 0.5, 0.75, 1]} />
      {nested &&
        NESTED_LEVELS.map((lv) => {
          const c = meanInterval('z', xbar, sigma, n, lv, alt)
          return (
            <g key={lv}>
              <line x1={cx(c.lower)} x2={cx(c.upper)} y1={y(1 - lv)} y2={y(1 - lv)} stroke="var(--c-obs)" strokeWidth={2.5} opacity={0.35} />
              <text x={cx(c.upper) + 4} y={y(1 - lv) + 4} fontSize={10} fill="var(--c-text-secondary)">
                {Math.round(lv * 100)}%
              </text>
            </g>
          )
        })}
      <line x1={m.l} x2={W - m.r} y1={y(a)} y2={y(a)} stroke="var(--c-reject)" strokeDasharray="5 4" strokeWidth={1.2} />
      <text x={m.l + 4} y={y(a) - 5} fontSize={11} fill="var(--c-reject)" fontWeight={600}>
        α = {Number(a.toFixed(4))} — 이보다 낮으면 기각
      </text>
      <line x1={cx(ci.lower)} x2={cx(ci.upper)} y1={y(a)} y2={y(a)} stroke="var(--c-obs)" strokeWidth={5} strokeLinecap="round" />
      {ends.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={y(a)} y2={y(0)} stroke="var(--c-obs)" strokeDasharray="3 3" />
          <circle cx={x(v)} cy={y(a)} r={4} fill="var(--c-obs)" />
        </g>
      ))}
      <path d={curve} fill="none" stroke="var(--c-pval)" strokeWidth={2.2} />
      <circle cx={cx(mu0)} cy={y(p0)} r={6} fill={p0 < a ? 'var(--c-miss)' : 'var(--c-cover)'} stroke="#fff" strokeWidth={1.5} />
      <line x1={cx(mu0)} x2={cx(mu0)} y1={y(p0)} y2={y(0)} stroke="var(--c-mu0)" strokeWidth={1.2} strokeDasharray="4 3" />
    </svg>
  )
}
