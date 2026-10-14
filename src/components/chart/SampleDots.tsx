// E08 M3: 선택한 반복의 원자료 n개와 그 반복의 신뢰구간·예측구간. "관측값의 95%가 신뢰구간 안"이 아님을 본다
import type { Interval } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'
import { PI_COLOR } from './PairStack'

interface Props {
  data: Float64Array
  ci: Interval
  pi: Interval
  domain: [number, number]
  ariaLabel: string
}

export function SampleDots({ data, ci, pi, domain, ariaLabel }: Props) {
  const H = 150
  const m = { l: 24, r: 16, t: 14, b: 40 }
  const { x, y } = makeScales(domain, [0, 1], H, m)
  const cx = (v: number) => x(clamp(v, domain[0], domain[1]))
  // 같은 자리의 점이 겹치지 않도록 세로로 쌓는다
  const sorted = Array.from(data).sort((a, b) => a - b)
  const placed: { v: number; level: number }[] = []
  const lastX: number[] = []
  for (const v of sorted) {
    let lv = 0
    while (lastX[lv] !== undefined && cx(v) - lastX[lv] < 7) lv++
    lastX[lv] = cx(v)
    placed.push({ v, level: lv })
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, 1]} H={H} m={m} xTitle="원자료 x_i" yTicks={[]} grid={false} />
      <rect x={cx(pi.lower)} width={cx(pi.upper) - cx(pi.lower)} y={m.t} height={H - m.t - m.b} fill="rgba(23, 107, 48, 0.08)" stroke={PI_COLOR} strokeDasharray="4 3" />
      <rect x={cx(ci.lower)} width={cx(ci.upper) - cx(ci.lower)} y={m.t} height={H - m.t - m.b} fill="var(--c-cover-fill)" stroke="var(--c-cover)" />
      {placed.map((p, i) => {
        const inCi = ci.lower <= p.v && p.v <= ci.upper
        return <circle key={i} cx={cx(p.v)} cy={H - m.b - 6 - p.level * 7} r={3} fill={inCi ? 'var(--c-cover)' : '#fff'} stroke="var(--c-text-secondary)" strokeWidth={1} />
      })}
    </svg>
  )
}
