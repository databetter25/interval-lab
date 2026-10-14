// E08: 반복마다 구간이 덮는 모집단 질량 P(L ≤ Y ≤ U)의 분포. β 선 오른쪽이 '모집단의 β 이상을 덮은' 반복
import { Axes, W, makeScales } from './frame'

interface Props {
  values: Float64Array
  beta: number
  color: string
  ariaLabel: string
}

const BINS = 40

export function MassHist({ values, beta, color, ariaLabel }: Props) {
  const H = 200
  const m = { l: 40, r: 16, t: 14, b: 42 }
  let lo = 1
  for (const v of values) lo = Math.min(lo, v)
  lo = Math.max(0, Math.min(beta - 0.05, Math.floor(lo * 50) / 50))
  const domain: [number, number] = [lo, 1]
  const w = (1 - lo) / BINS
  const counts = new Array<number>(BINS).fill(0)
  for (const v of values) counts[Math.min(BINS - 1, Math.max(0, Math.floor((v - lo) / w)))]++
  const yMax = Math.max(1, ...counts) * 1.12
  const { x, y } = makeScales(domain, [0, yMax], H, m)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, yMax]} H={H} m={m} xTitle="구간이 덮은 모집단 비율 P(L ≤ Y ≤ U)" yTicks={[]} xFormat={(v) => `${Math.round(v * 1000) / 10}%`} grid={false} />
      {counts.map((c, i) => {
        const a = lo + i * w
        const over = a + w / 2 >= beta
        return c ? <rect key={i} x={x(a) + 0.5} width={Math.max(1, x(a + w) - x(a) - 1)} y={y(c)} height={y(0) - y(c)} fill={color} opacity={over ? 0.6 : 0.2} stroke={color} strokeWidth={0.6} /> : null
      })}
      <line x1={x(beta)} x2={x(beta)} y1={m.t} y2={y(0)} stroke="var(--c-truth)" strokeWidth={1.6} strokeDasharray="5 3" />
      <text x={x(beta) - 4} y={m.t + 10} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--c-truth)">
        β = {Math.round(beta * 1000) / 10}%
      </text>
    </svg>
  )
}
