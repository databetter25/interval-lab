// 100개 묶음마다의 포함 개수 히스토그램과 Binomial(100, 1−α) PMF
import { binomPmf } from '../../engine/repeat'
import { Axes, W, makeScales } from './frame'

interface Props {
  counts: number[]
  level: number
  ariaLabel: string
}

export function BlockHist({ counts, level, ariaLabel }: Props) {
  const H = 220
  const m = { l: 66, r: 14, t: 12, b: 40 }
  const mean = 100 * level
  const sd = Math.sqrt(100 * level * (1 - level))
  const lo = Math.max(0, Math.floor(Math.min(mean - 4 * sd, ...counts)))
  const hi = Math.min(100, Math.ceil(Math.max(mean + 4 * sd, ...counts)))
  const freq = new Map<number, number>()
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1)
  const ks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const pmf = ks.map((k) => binomPmf(k, 100, level))
  const rel = ks.map((k) => (freq.get(k) ?? 0) / counts.length)
  const yMax = Math.max(...pmf, ...rel) * 1.12
  const { x, y } = makeScales([lo - 0.5, hi + 0.5], [0, yMax], H, m)
  const bw = Math.max(2, (x(1) - x(0)) * 0.8)
  const ticks = ks.filter((k) => k % (hi - lo > 30 ? 5 : 2) === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={[lo - 0.5, hi + 0.5]} yDomain={[0, yMax]} H={H} m={m} xTitle="100개 묶음 안에서 참값을 포함한 구간 수" yTitle="비율" xTicks={ticks} yFormat={(v) => v.toFixed(2)} />
      {ks.map((k, i) => (
        <rect key={k} x={x(k) - bw / 2} width={bw} y={y(rel[i])} height={y(0) - y(rel[i])} fill="var(--c-cover-fill)" stroke="var(--c-cover)" strokeWidth={0.6} />
      ))}
      <path d={ks.map((k, i) => `${i ? 'L' : 'M'}${x(k).toFixed(1)},${y(pmf[i]).toFixed(1)}`).join('')} fill="none" stroke="var(--c-truth)" strokeWidth={1.2} strokeDasharray="4 3" />
      {ks.map((k, i) => (
        <circle key={k} cx={x(k)} cy={y(pmf[i])} r={2.2} fill="var(--c-truth)" />
      ))}
    </svg>
  )
}
