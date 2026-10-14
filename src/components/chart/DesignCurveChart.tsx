// E05 설계 곡선: n–E, 수준–길이, z 대 t 기대 길이. 로그 축을 고를 수 있다 (로그–로그에서 E ∝ 1/√n은 기울기 −1/2 직선)
import type { Ref } from 'react'
import { fmtTick, niceTicks } from './scale'
import { Axes, W, clamp, makeScales } from './frame'

export interface Series {
  label: string
  color: string
  dash?: string
  f: (x: number) => number
}

export interface Mark {
  x: number
  label: string
  color: string
}

interface Props {
  domain: [number, number]
  series: Series[]
  marks?: Mark[]
  xLog?: boolean
  yLog?: boolean
  xTitle: string
  yTitle: string
  xFormat?: (v: number) => string
  yFormat?: (v: number) => string
  integerX?: boolean
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
  height?: number
  xTickCount?: number
}

/** 값이 없는(NaN·∞) 점에서 선을 끊는다 */
function segments(xs: number[], f: (x: number) => number, X: (v: number) => number, Y: (v: number) => number): string {
  let d = ''
  let pen = false
  for (const v of xs) {
    const yv = f(v)
    if (!Number.isFinite(yv)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${X(v).toFixed(1)},${Y(yv).toFixed(1)}`
    pen = true
  }
  return d
}

const logTicks = (lo: number, hi: number) => {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) {
    const v = m * 10 ** e
    if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v)
  }
  return out
}

export function DesignCurveChart({ domain, series, marks = [], xLog = false, yLog = false, xTitle, yTitle, xFormat = fmtTick, yFormat = fmtTick, integerX = false, svgRef, ariaLabel, height = 250, xTickCount = 7 }: Props) {
  const H = height
  const m = { l: 66, r: 16, t: 16, b: 42 }
  const N = 240
  const xs = Array.from({ length: N + 1 }, (_, i) => (xLog ? domain[0] * (domain[1] / domain[0]) ** (i / N) : domain[0] + ((domain[1] - domain[0]) * i) / N)).map((v) => (integerX ? Math.max(domain[0], Math.round(v)) : v))
  const all = series.flatMap((s) => xs.map(s.f)).filter((v) => Number.isFinite(v) && v > 0)
  const yLo = yLog ? Math.min(...all) * 0.85 : 0
  const yHi = Math.max(...all) * 1.08
  const tx = (v: number) => (xLog ? Math.log10(v) : v)
  const ty = (v: number) => (yLog ? Math.log10(v) : v)
  const { x, y } = makeScales([tx(domain[0]), tx(domain[1])], [ty(yLo), ty(yHi)], H, m)
  const X = (v: number) => x(tx(v))
  const Y = (v: number) => y(clamp(ty(Math.max(v, yLog ? yLo : -Infinity)), ty(yLo), ty(yHi)))
  const xTicks = xLog ? logTicks(domain[0], domain[1]) : niceTicks(domain[0], domain[1], xTickCount)
  const yTicks = yLog ? logTicks(yLo, yHi) : niceTicks(yLo, yHi, 5)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={[tx(domain[0]), tx(domain[1])]} yDomain={[ty(yLo), ty(yHi)]} H={H} m={m} xTitle={xTitle} yTitle={yTitle} xTicks={xTicks.map(tx)} yTicks={yTicks.map(ty)} xFormat={(t) => xFormat(xLog ? 10 ** t : t)} yFormat={(t) => yFormat(yLog ? 10 ** t : t)} />
      {series.map((s) => (
        <path key={s.label} d={segments(xs, s.f, X, Y)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
      ))}
      {marks.map((mk, i) => {
        const v = series[0].f(mk.x)
        const right = X(mk.x) > W - 150
        return (
          <g key={`${mk.label}${i}`}>
            <line x1={X(mk.x)} x2={X(mk.x)} y1={Y(v)} y2={H - m.b} stroke={mk.color} strokeDasharray="3 3" />
            <circle cx={X(mk.x)} cy={Y(v)} r={5} fill={mk.color} stroke="#fff" strokeWidth={1.5} />
            <text x={right ? X(mk.x) - 8 : X(mk.x) + 8} y={Y(v) - 8} textAnchor={right ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={mk.color}>
              {mk.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
