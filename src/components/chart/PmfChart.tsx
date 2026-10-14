// 7장 미니뷰(이항): H₀: p = p₀에서 X의 분포. 채택역은 채운 막대, 기각역은 빗금 막대
import { useId } from 'react'
import { binomPmfExact } from '../../engine/binomial'
import { Axes, HatchDef, W, makeScales } from './frame'

interface Props {
  n: number
  p0: number
  accept: boolean[]
  observed?: number
  /** p-값에 들어가는 x들 (정확검정의 작은 쪽 꼬리) */
  pBars?: boolean[]
  ariaLabel: string
}

export function PmfChart({ n, p0, accept, observed, pBars, ariaLabel }: Props) {
  const H = 190
  const m = { l: 50, r: 14, t: 18, b: 40 }
  const pmf = Array.from({ length: n + 1 }, (_, k) => binomPmfExact(k, n, p0))
  const yMax = Math.max(...pmf) * 1.18 || 1
  const { x, y } = makeScales([-0.5, n + 0.5], [0, yMax], H, m)
  const bw = Math.max(1.5, (x(1) - x(0)) * 0.72)
  const hatch = useId().replace(/:/g, '')
  const step = n <= 12 ? 1 : n <= 30 ? 5 : 10
  const accMass = pmf.reduce((a, v, k) => a + (accept[k] ? v : 0), 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <HatchDef id={hatch} color="var(--c-reject)" />
      <Axes x={x} y={y} xDomain={[-0.5, n + 0.5]} yDomain={[0, yMax]} H={H} m={m} xTitle="x" yTicks={[]} xTicks={Array.from({ length: n + 1 }, (_, k) => k).filter((k) => k % step === 0 || k === n)} />
      {pmf.map((v, k) => (
        <rect key={k} x={x(k) - bw / 2} width={bw} y={y(v)} height={Math.max(0, y(0) - y(v))} fill={accept[k] ? 'var(--c-mu0)' : `url(#${hatch})`} stroke={accept[k] ? 'none' : 'var(--c-reject)'} strokeWidth={0.8} opacity={accept[k] ? 0.75 : 1} />
      ))}
      {pBars?.map((on, k) => (on ? <rect key={`p${k}`} x={x(k) - bw / 2 - 2} width={bw + 4} y={y(pmf[k]) - 2} height={Math.max(0, y(0) - y(pmf[k])) + 2} fill="var(--c-pval-fill)" stroke="var(--c-pval)" strokeWidth={1.2} /> : null))}
      {observed !== undefined && (
        <g>
          <line x1={x(observed)} x2={x(observed)} y1={m.t + 2} y2={y(0)} stroke="var(--c-obs)" strokeWidth={2} />
          <text x={x(observed) + 5} y={m.t + 12} fontSize={11} fontWeight={600} fill="var(--c-obs)">
            관측 x = {observed}
          </text>
        </g>
      )}
      <text x={W - m.r} y={m.t - 4} textAnchor="end" fontSize={11} fill="var(--c-mu0)" fontWeight={600}>
        H₀: p = {Number(p0.toFixed(4))} · 채택역 질량 {accMass.toFixed(4)}
      </text>
    </svg>
  )
}
