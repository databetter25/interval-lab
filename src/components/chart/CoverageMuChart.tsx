// E07 사전 민감도: 고정된 참값 μ마다 신용구간의 반복표집 포함률 (정확), 신뢰구간은 언제나 1 − α
import { credibleCoverage, type Prior } from '../../engine/threeViews'
import { Axes, W, clamp, makeScales } from './frame'

interface Props {
  sigma: number
  n: number
  level: number
  prior: Prior
  domain: [number, number]
  mark: number
  mc?: { value: number; se: number }
  ariaLabel: string
}

export function CoverageMuChart({ sigma, n, level, prior, domain, mark, mc, ariaLabel }: Props) {
  const H = 230
  const m = { l: 66, r: 16, t: 14, b: 42 }
  const N = 240
  const mus = Array.from({ length: N + 1 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / N)
  const cs = mus.map((mu) => credibleCoverage(mu, sigma, n, level, prior))
  const { x, y } = makeScales(domain, [0, 1], H, m)
  const path = mus.map((mu, i) => `${i ? 'L' : 'M'}${x(mu).toFixed(1)},${y(cs[i]).toFixed(1)}`).join('')
  const cMark = credibleCoverage(mark, sigma, n, level, prior)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, 1]} H={H} m={m} xTitle="고정된 참값 μ" yTitle="포함률" yTicks={[0, 0.25, 0.5, 0.75, 1]} yFormat={(v) => `${Math.round(v * 100)}%`} />
      <line x1={m.l} x2={W - m.r} y1={y(level)} y2={y(level)} stroke="var(--c-cover)" strokeWidth={2} />
      <text x={W - m.r - 4} y={y(level) - 6} textAnchor="end" fontSize={11} fill="var(--c-cover)" fontWeight={600}>
        신뢰구간: 모든 μ에서 {Math.round(level * 1000) / 10}%
      </text>
      <path d={path} fill="none" stroke="var(--c-pval)" strokeWidth={2.2} strokeDasharray="6 3" />
      {prior.kind === 'normal' && (
        <g>
          <line x1={x(clamp(prior.m0, domain[0], domain[1]))} x2={x(clamp(prior.m0, domain[0], domain[1]))} y1={m.t} y2={H - m.b} stroke="var(--c-pval)" strokeWidth={1} strokeDasharray="2 3" />
          <text x={x(clamp(prior.m0, domain[0], domain[1])) + 4} y={H - m.b - 6} fontSize={10} fill="var(--c-pval)">
            사전평균 m₀
          </text>
        </g>
      )}
      <line x1={x(mark)} x2={x(mark)} y1={m.t} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={1.6} />
      <circle cx={x(mark)} cy={y(cMark)} r={5} fill="var(--c-pval)" stroke="#fff" strokeWidth={1.5} />
      {mc && (
        <g>
          <line x1={x(mark) + 9} x2={x(mark) + 9} y1={y(clamp(mc.value - 2 * mc.se, 0, 1))} y2={y(clamp(mc.value + 2 * mc.se, 0, 1))} stroke="var(--c-truth)" strokeWidth={1.5} />
          <rect x={x(mark) + 6} y={y(mc.value) - 3} width={6} height={6} fill="var(--c-truth)" />
        </g>
      )}
    </svg>
  )
}
