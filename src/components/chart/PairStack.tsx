// E08: 반복마다 신뢰구간(모평균 대상)과 예측구간(새 관측값 대상)을 함께 그린다.
// 세로선 = 참값 μ (고정), 점 = 그 반복의 새 관측값 Y_b
import type { Ref } from 'react'
import type { Interval } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'

export interface PairItem {
  b: number
  ci: Interval
  pi: Interval
  y: number
}

interface Props {
  items: PairItem[]
  rows: number
  truth: number
  domain: [number, number]
  selected: number
  onSelect: (b: number) => void
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

export const PI_COLOR = '#176b30'

export function PairStack({ items, rows, truth, domain, selected, onSelect, svgRef, ariaLabel }: Props) {
  const H = 420
  const m = { l: 56, r: 16, t: 28, b: 40 }
  const { x, y: yScale } = makeScales(domain, [0, 1], H, m)
  const rowH = (H - m.t - m.b) / Math.max(rows, 1)
  const yOf = (i: number) => m.t + rowH * (i + 0.5)
  const cx = (v: number) => x(clamp(v, domain[0], domain[1]))
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={yScale} xDomain={domain} yDomain={[0, 1]} H={H} m={m} xTitle="관측값의 척도" yTicks={[]} grid={false} />
      {items.map((it, i) => {
        const yy = yOf(i)
        const sel = it.b === selected
        const piHit = it.pi.lower <= it.y && it.y <= it.pi.upper
        const ciHit = it.ci.lower <= truth && truth <= it.ci.upper
        return (
          <g key={it.b} onClick={() => onSelect(it.b)} style={{ cursor: 'pointer' }}>
            <rect x={m.l} width={W - m.l - m.r} y={yy - rowH / 2} height={rowH} fill={sel ? 'var(--c-sel-bg)' : 'transparent'} />
            <line x1={cx(it.pi.lower)} x2={cx(it.pi.upper)} y1={yy} y2={yy} stroke={PI_COLOR} strokeWidth={Math.max(1, rowH * 0.22)} opacity={0.55} />
            <line x1={cx(it.ci.lower)} x2={cx(it.ci.upper)} y1={yy} y2={yy} stroke={ciHit ? 'var(--c-cover)' : 'var(--c-miss)'} strokeWidth={Math.max(1.6, rowH * 0.5)} />
            {piHit ? (
              <circle cx={cx(it.y)} cy={yy} r={Math.max(2, Math.min(4, rowH * 0.42))} fill="#fff" stroke={PI_COLOR} strokeWidth={1.5} />
            ) : (
              <text x={cx(it.y)} y={yy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--c-miss)">
                ✕
              </text>
            )}
          </g>
        )
      })}
      <line x1={x(truth)} x2={x(truth)} y1={m.t - 6} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={2.2} />
      <text x={x(truth)} y={m.t - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--c-truth)">
        모평균 μ = {truth} (교육용 생성 조건, 고정)
      </text>
      {items.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--c-text-tertiary)">
          아직 뽑은 표본이 없습니다. 위의 버튼을 눌러 시작하세요.
        </text>
      )}
    </svg>
  )
}
