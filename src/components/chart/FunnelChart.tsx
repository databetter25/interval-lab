// 수렴 깔때기: 누적 포함률과 1−α ± 2·√(α(1−α)/b) 띠 (M2: "반드시 95번"이 아님을 보인다)
import { Axes, W, clamp, makeScales } from './frame'

interface Props {
  cumulative: Uint32Array
  count: number
  level: number
  ariaLabel: string
}

export function FunnelChart({ cumulative, count, level, ariaLabel }: Props) {
  const H = 230
  const m = { l: 66, r: 14, t: 12, b: 40 }
  const maxB = Math.max(10, count)
  const lx = (b: number) => Math.log10(b)
  const xDomain: [number, number] = [0, lx(maxB)]
  const yDomain: [number, number] = [Math.max(0, level - 0.25), 1]
  const { x, y } = makeScales(xDomain, yDomain, H, m)
  const a = 1 - level

  // 로그 간격으로 최대 400점
  const pts: [number, number][] = []
  if (count > 0) {
    const N = Math.min(400, count)
    let last = 0
    for (let i = 0; i < N; i++) {
      const b = Math.max(1, Math.round(10 ** ((lx(count) * (i + 1)) / N)))
      if (b === last) continue
      last = b
      pts.push([b, cumulative[b - 1] / b])
    }
  }
  const band: string[] = []
  const M = 120
  for (let i = 0; i <= M; i++) {
    const b = 10 ** ((xDomain[1] * i) / M)
    band.push(`${i ? 'L' : 'M'}${x(lx(b)).toFixed(1)},${y(clamp(level + 2 * Math.sqrt((a * level) / b), yDomain[0], yDomain[1])).toFixed(1)}`)
  }
  for (let i = M; i >= 0; i--) {
    const b = 10 ** ((xDomain[1] * i) / M)
    band.push(`L${x(lx(b)).toFixed(1)},${y(clamp(level - 2 * Math.sqrt((a * level) / b), yDomain[0], yDomain[1])).toFixed(1)}`)
  }
  const xTicks = [0, 1, 2, 3, 4, 5].filter((t) => t <= xDomain[1] + 1e-9)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={xDomain} yDomain={yDomain} H={H} m={m} xTitle="반복 수 b (로그 눈금)" yTitle="누적 포함률" xTicks={xTicks} xFormat={(t) => (10 ** t).toLocaleString('ko-KR')} yFormat={(v) => `${Math.round(v * 100)}%`} />
      <path d={band.join('') + 'Z'} fill="var(--c-accept-fill)" stroke="none" />
      <line x1={m.l} x2={W - m.r} y1={y(level)} y2={y(level)} stroke="var(--c-truth)" strokeDasharray="5 4" strokeWidth={1.2} />
      <text x={m.l + 6} y={y(level) + 14} fontSize={11} fill="var(--c-truth)">
        명목수준 {Math.round(level * 1000) / 10}% (띠: ±2 MC 표준오차)
      </text>
      {pts.length > 0 && <path d={pts.map(([b, c], i) => `${i ? 'L' : 'M'}${x(lx(b)).toFixed(1)},${y(clamp(c, yDomain[0], yDomain[1])).toFixed(1)}`).join('')} fill="none" stroke="var(--c-cover)" strokeWidth={2} />}
      {pts.length > 0 && <circle cx={x(lx(pts[pts.length - 1][0]))} cy={y(clamp(pts[pts.length - 1][1], yDomain[0], yDomain[1]))} r={3.5} fill="var(--c-cover)" />}
    </svg>
  )
}
