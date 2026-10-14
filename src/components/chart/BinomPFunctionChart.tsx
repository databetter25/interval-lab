// E04 이항 p-값 함수 p(p₀): 뒤집는 검정마다 곡선이 다르고, 높이 α에서 자르면 그 검정의 구간이 나온다
import type { Ref } from 'react'
import { binomInterval, binomTestP, type BinomMethod } from '../../engine/binomial'
import { Axes, W, clamp, makeScales } from './frame'
import { NESTED_LEVELS } from './PFunctionChart'

interface Props {
  x: number
  n: number
  level: number
  method: BinomMethod
  /** 비교용으로 함께 그릴 다른 방법 (점선) */
  compare: { method: BinomMethod; color: string }[]
  p0: number
  nested: boolean
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

const N = 500
const GRID = Array.from({ length: N + 1 }, (_, i) => i / N)

export function BinomPFunctionChart({ x, n, level, method, compare, p0, nested, svgRef, ariaLabel }: Props) {
  const H = 260
  const m = { l: 66, r: 16, t: 14, b: 40 }
  const { x: sx, y } = makeScales([0, 1], [0, 1], H, m)
  const a = 1 - level
  const path = (mt: BinomMethod) => GRID.map((t, i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${y(binomTestP(x, n, t, mt)).toFixed(1)}`).join('')
  const ci = binomInterval(x, n, level, method)
  const cx = (v: number) => sx(clamp(v, 0, 1))
  const p = binomTestP(x, n, p0, method)
  // 끝점이 경계(0 또는 1)에 붙은 경우는 α와 만나는 점이 아니다 (CP: x = 0이면 L = 0)
  const ends = [ci.lower, ci.upper].filter((v) => v > 0 && v < 1)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={sx} y={y} xDomain={[0, 1]} yDomain={[0, 1]} H={H} m={m} xTitle="가설값 p₀" yTitle="p-값" yTicks={[0, 0.25, 0.5, 0.75, 1]} xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]} />
      {nested &&
        NESTED_LEVELS.map((lv) => {
          const c = binomInterval(x, n, lv, method)
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
      <text x={W - m.r - 4} y={y(a) - 5} textAnchor="end" fontSize={11} fill="var(--c-reject)" fontWeight={600}>
        α = {Number(a.toFixed(4))} — 이보다 낮으면 기각
      </text>
      <line x1={cx(ci.lower)} x2={cx(ci.upper)} y1={y(a)} y2={y(a)} stroke="var(--c-obs)" strokeWidth={5} strokeLinecap="round" />
      {ends.map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={y(a)} y2={y(0)} stroke="var(--c-obs)" strokeDasharray="3 3" />
          <circle cx={sx(v)} cy={y(a)} r={4} fill="var(--c-obs)" />
        </g>
      ))}
      {compare.map((c) => (
        <path key={c.method} d={path(c.method)} fill="none" stroke={c.color} strokeWidth={1.5} strokeDasharray="5 3" />
      ))}
      <path d={path(method)} fill="none" stroke="var(--c-pval)" strokeWidth={2.2} />
      <line x1={sx(p0)} x2={sx(p0)} y1={y(p)} y2={y(0)} stroke="var(--c-mu0)" strokeWidth={1.2} strokeDasharray="4 3" />
      <circle cx={sx(p0)} cy={y(p)} r={6} fill={p < a ? 'var(--c-miss)' : 'var(--c-cover)'} stroke="#fff" strokeWidth={1.5} />
    </svg>
  )
}
