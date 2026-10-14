// 7장 미니뷰: H₀: μ = μ₀에서 X̄의 표본분포, 기각역(빗금), 관측 x̄, p-값 영역
import { useId } from 'react'
import { normPdf } from '../../engine/core/normal'
import { acceptanceRegion, type Alt } from '../../engine/meanInterval'
import { Axes, HatchDef, W, clamp, makeScales } from './frame'

interface Props {
  mu0: number
  se: number
  level: number
  alt: Alt
  domain: [number, number]
  observed?: number
  showP?: boolean
  height?: number
  ariaLabel: string
}

export function DensityChart({ mu0, se, level, alt, domain, observed, showP = false, height = 200, ariaLabel }: Props) {
  const H = height
  const m = { l: 50, r: 14, t: 12, b: 40 }
  const peak = normPdf(0) / se
  const { x, y } = makeScales(domain, [0, peak * 1.15], H, m)
  const hatch = useId().replace(/:/g, '')
  const f = (v: number) => normPdf((v - mu0) / se) / se
  const acc = acceptanceRegion(mu0, se, level, alt)

  const area = (a: number, b: number) => {
    const lo = clamp(a, domain[0], domain[1])
    const hi = clamp(b, domain[0], domain[1])
    if (hi <= lo) return ''
    const N = 60
    const pts = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N)
    return `M${x(lo).toFixed(1)},${y(0).toFixed(1)}` + pts.map((v) => `L${x(v).toFixed(1)},${y(f(v)).toFixed(1)}`).join('') + `L${x(hi).toFixed(1)},${y(0).toFixed(1)}Z`
  }
  const N = 200
  const curve = Array.from({ length: N + 1 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / N)
    .map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(f(v)).toFixed(1)}`)
    .join('')

  // p-값 영역: 관측값보다 극단인 쪽 (양측은 μ₀ 기준 대칭)
  let pAreas: string[] = []
  if (showP && observed !== undefined) {
    const d = Math.abs(observed - mu0)
    if (alt === 'two') pAreas = [area(-Infinity, mu0 - d), area(mu0 + d, Infinity)]
    else if (alt === 'greater') pAreas = [area(observed, Infinity)]
    else pAreas = [area(-Infinity, observed)]
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <HatchDef id={hatch} color="var(--c-reject)" />
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, peak * 1.15]} H={H} m={m} xTitle="x̄" yTicks={[]} />
      {pAreas.map((d, i) => d && <path key={i} d={d} fill="var(--c-pval-fill)" stroke="none" />)}
      {acc.lower > -Infinity && <path d={area(-Infinity, acc.lower)} fill={`url(#${hatch})`} stroke="var(--c-reject)" strokeWidth={0.8} />}
      {acc.upper < Infinity && <path d={area(acc.upper, Infinity)} fill={`url(#${hatch})`} stroke="var(--c-reject)" strokeWidth={0.8} />}
      <path d={curve} fill="none" stroke="var(--c-mu0)" strokeWidth={2} />
      <line x1={x(clamp(acc.lower, domain[0], domain[1]))} x2={x(clamp(acc.upper, domain[0], domain[1]))} y1={y(0) - 3} y2={y(0) - 3} stroke="var(--c-mu0)" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
      <text x={x(mu0)} y={y(peak) - 6} textAnchor="middle" fontSize={11} fill="var(--c-mu0)" fontWeight={600}>
        H₀: μ = {Number(mu0.toFixed(3))}일 때 X̄ ~ N(μ₀, SE²)
      </text>
      {observed !== undefined && (
        <g>
          <line x1={x(clamp(observed, domain[0], domain[1]))} x2={x(clamp(observed, domain[0], domain[1]))} y1={m.t + 14} y2={y(0)} stroke="var(--c-obs)" strokeWidth={2} />
          <text x={x(clamp(observed, domain[0], domain[1])) + 5} y={m.t + 26} fontSize={11} fill="var(--c-obs)" fontWeight={600}>
            관측 x̄
          </text>
        </g>
      )}
    </svg>
  )
}
