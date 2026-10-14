// E01 주 시각화: 고정된 참값선과 반복마다 움직이는 구간 (PRD v2 §6.5 시각 의미 규칙)
import type { Ref } from 'react'
import type { MissSide } from '../../engine/repeat'
import { Axes, W, clamp, makeScales } from './frame'

export interface StackItem {
  b: number
  lower: number
  upper: number
  side: MissSide
}

interface Props {
  items: StackItem[]
  /** 그림의 세로 칸 수 (표시 구간 수) */
  rows: number
  truth: number
  hideTruth: boolean
  domain: [number, number]
  selected: number
  onSelect: (b: number) => void
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

export function IntervalStack({ items, rows, truth, hideTruth, domain, selected, onSelect, svgRef, ariaLabel }: Props) {
  const H = 440
  const m = { l: 56, r: 26, t: 28, b: 40 }
  const { x, y } = makeScales(domain, [0, 1], H, m)
  const rowH = (H - m.t - m.b) / Math.max(rows, 1)
  const stroke = Math.max(1.2, Math.min(3.2, rowH * 0.55))
  const firstB = items.length ? items[0].b : 0
  const yOf = (i: number) => m.t + rowH * (i + 0.5)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, 1]} H={H} m={m} xTitle="μ의 척도 (구간의 위치)" yTicks={[]} grid={false} />
      {items.length > 0 && (
        <g className="axis">
          <text x={m.l - 8} y={yOf(0) + 4} textAnchor="end">
            #{firstB + 1}
          </text>
          <text x={m.l - 8} y={yOf(items.length - 1) + 4} textAnchor="end">
            #{items[items.length - 1].b + 1}
          </text>
        </g>
      )}
      {items.map((it, i) => {
        const y = yOf(i)
        const lo = clamp(it.lower, domain[0], domain[1])
        const hi = clamp(it.upper, domain[0], domain[1])
        const miss = !hideTruth && it.side !== 'none'
        const color = hideTruth ? 'var(--c-neutral)' : miss ? 'var(--c-miss)' : 'var(--c-cover)'
        const sel = it.b === selected
        const isNew = i === items.length - 1
        return (
          <g key={it.b} className={isNew ? 'stack-new' : undefined} onClick={() => onSelect(it.b)} style={{ cursor: 'pointer' }}>
            <rect x={m.l} width={W - m.l - m.r} y={y - rowH / 2} height={rowH} fill={sel ? 'var(--c-sel-bg)' : 'transparent'} />
            <line x1={x(lo)} x2={x(hi)} y1={y} y2={y} stroke={color} strokeWidth={sel ? stroke + 1.6 : miss ? stroke + 0.6 : stroke} strokeLinecap="butt" />
            {it.lower < domain[0] && <path d={`M${x(domain[0]) + 6},${y - 3} L${x(domain[0])},${y} L${x(domain[0]) + 6},${y + 3}`} fill="none" stroke={color} strokeWidth={1} />}
            {it.upper > domain[1] && <path d={`M${x(domain[1]) - 6},${y - 3} L${x(domain[1])},${y} L${x(domain[1]) - 6},${y + 3}`} fill="none" stroke={color} strokeWidth={1} />}
            {miss && (
              <text x={W - m.r + 4} y={y + Math.min(4, rowH / 2 + 1)} fontSize={Math.max(7, Math.min(12, rowH * 1.4))} fill="var(--c-miss)" fontWeight={700} aria-hidden="true">
                ✕
              </text>
            )}
          </g>
        )
      })}
      {!hideTruth && (
        <g>
          <line x1={x(truth)} x2={x(truth)} y1={m.t - 6} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={2.4} />
          <text x={x(truth)} y={m.t - 10} textAnchor="middle" fontSize={11} fill="var(--c-truth)" fontWeight={600}>
            참값 μ = {truth} (교육용 생성 조건)
          </text>
        </g>
      )}
      {items.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--c-text-tertiary)">
          아직 뽑은 표본이 없습니다. 위의 ‘1회’ 버튼을 눌러 시작하세요.
        </text>
      )}
    </svg>
  )
}
