// E10 오포함확률 곡선 P_θ{θ′ ∈ C}: 아래 넓이 = 기대 길이 (Pratt). 1 − 검정력(점)을 겹쳐 같은 곡선임을 보인다
import type { Ref } from 'react'
import { Axes, W, clamp, makeScales } from './frame'

export interface FcCurve {
  label: string
  color: string
  dash?: string
  f: (thetaPrime: number) => number
}

interface Props {
  domain: [number, number]
  theta: number
  thetaPrime: number
  main: FcCurve
  /** 따로 계산한 1 − 검정력 (점으로) */
  check: (thetaPrime: number) => number
  others: FcCurve[]
  /** MC 추정 곡선 (점선 + 점) */
  mc?: { label: string; color: string; points: [number, number][] }
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

export function FalseCoverageChart({ domain, theta, thetaPrime, main, check, others, mc, svgRef, ariaLabel }: Props) {
  const H = 300
  const m = { l: 66, r: 16, t: 18, b: 42 }
  const { x, y } = makeScales(domain, [0, 1], H, m)
  const N = 300
  const ts = Array.from({ length: N + 1 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / N)
  const path = (f: (v: number) => number) => ts.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(clamp(f(t), 0, 1)).toFixed(1)}`).join('')
  const area = path(main.f) + `L${x(domain[1]).toFixed(1)},${y(0).toFixed(1)}L${x(domain[0]).toFixed(1)},${y(0).toFixed(1)}Z`
  const dots = Array.from({ length: 25 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * (i + 0.5)) / 25)
  const vp = main.f(thetaPrime)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, 1]} H={H} m={m} xTitle="다른 값 θ′" yTitle="P_θ{θ′ ∈ C(X)}" yTicks={[0, 0.25, 0.5, 0.75, 1]} />
      <path d={area} fill="var(--c-cover-fill)" stroke="none" />
      {others.map((o) => (
        <path key={o.label} d={path(o.f)} fill="none" stroke={o.color} strokeWidth={1.6} strokeDasharray={o.dash ?? '5 4'} />
      ))}
      <path d={path(main.f)} fill="none" stroke={main.color} strokeWidth={2.2} />
      {dots.map((t) => (
        <circle key={t} cx={x(t)} cy={y(clamp(check(t), 0, 1))} r={3.4} fill="#fff" stroke="#176b30" strokeWidth={1.4} />
      ))}
      {mc && (
        <g>
          <path d={mc.points.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(clamp(v, 0, 1)).toFixed(1)}`).join('')} fill="none" stroke={mc.color} strokeWidth={1.6} strokeDasharray="6 3" />
        </g>
      )}
      <line x1={x(theta)} x2={x(theta)} y1={m.t} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={2} />
      <text x={x(theta) + 5} y={m.t + 4} fontSize={11} fontWeight={600} fill="var(--c-truth)">
        참값 θ (여기서는 포함률)
      </text>
      <line x1={x(thetaPrime)} x2={x(thetaPrime)} y1={y(vp)} y2={H - m.b} stroke="var(--c-mu0)" strokeWidth={1.4} strokeDasharray="4 3" />
      <circle cx={x(thetaPrime)} cy={y(vp)} r={6} fill="var(--c-mu0)" stroke="#fff" strokeWidth={1.5} />
      <text x={x(thetaPrime) > W - 160 ? x(thetaPrime) - 8 : x(thetaPrime) + 8} y={y(vp) - 8} textAnchor={x(thetaPrime) > W - 160 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill="var(--c-mu0)">
        θ′ = {Number(thetaPrime.toFixed(2))}: {vp.toFixed(4)}
      </text>
    </svg>
  )
}
