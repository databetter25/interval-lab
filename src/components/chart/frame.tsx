import type { ReactNode } from 'react'
import { fmtTick, linear, niceTicks } from './scale'

export const W = 640

export interface Margin {
  l: number
  r: number
  t: number
  b: number
}

export function makeScales(xDomain: [number, number], yDomain: [number, number], H: number, m: Margin) {
  return { x: linear(xDomain[0], xDomain[1], m.l, W - m.r), y: linear(yDomain[0], yDomain[1], H - m.b, m.t) }
}

interface AxesProps {
  x: ReturnType<typeof linear>
  y: ReturnType<typeof linear>
  xDomain: [number, number]
  yDomain: [number, number]
  H: number
  m: Margin
  xTitle: string
  yTitle?: string
  xTicks?: number[]
  yTicks?: number[]
  xFormat?: (v: number) => string
  yFormat?: (v: number) => string
  grid?: boolean
}

export function Axes({ x, y, xDomain, yDomain, H, m, xTitle, yTitle, xTicks, yTicks, xFormat = fmtTick, yFormat = fmtTick, grid = true }: AxesProps) {
  const xt = xTicks ?? niceTicks(xDomain[0], xDomain[1], 7)
  const yt = yTicks ?? niceTicks(yDomain[0], yDomain[1], 5)
  return (
    <g className="axis">
      {yt.map((t) => (
        <g key={`y${t}`}>
          {grid && <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--c-border-lt)" />}
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {yFormat(t)}
          </text>
        </g>
      ))}
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--c-text-tertiary)" />
      {xt.map((t) => (
        <g key={`x${t}`}>
          <line x1={x(t)} x2={x(t)} y1={H - m.b} y2={H - m.b + 4} stroke="var(--c-text-tertiary)" />
          <text x={x(t)} y={H - m.b + 17} textAnchor="middle">
            {xFormat(t)}
          </text>
        </g>
      ))}
      <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">
        {xTitle}
      </text>
      {yTitle && (
        <text className="axis-title" transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">
          {yTitle}
        </text>
      )}
    </g>
  )
}

/** 빗금 무늬 (기각역). id는 차트마다 달라야 한다 */
export function HatchDef({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--c-reject-fill)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2" />
      </pattern>
    </defs>
  )
}

export function ChartBox({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  return (
    <figure className="chart" style={{ margin: 0 }}>
      {children}
      {caption && <figcaption className="chart-caption">{caption}</figcaption>}
    </figure>
  )
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
