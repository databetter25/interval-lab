// E07 패널용: 정규 밀도와 가운데 구간의 넓이 (패널마다 가로축이 무엇인지가 다르다)
import { normPdf } from '../../engine/core/normal'
import { Axes, W, clamp, makeScales } from './frame'

interface Props {
  mean: number
  sd: number
  lo: number
  hi: number
  domain: [number, number]
  xTitle: string
  color: string
  fill: string
  /** 세로 표시선 (예: 관측 x̄, 사전평균) */
  marks?: { at: number; label: string; color: string; dash?: string }[]
  areaLabel: string
  ariaLabel: string
  height?: number
}

export function NormalAreaChart({ mean, sd, lo, hi, domain, xTitle, color, fill, marks = [], areaLabel, ariaLabel, height = 170 }: Props) {
  const H = height
  const m = { l: 18, r: 18, t: 22, b: 40 }
  const peak = normPdf(0) / sd
  const { x, y } = makeScales(domain, [0, peak * 1.2], H, m)
  const f = (v: number) => normPdf((v - mean) / sd) / sd
  const N = 160
  const pts = (a: number, b: number) => Array.from({ length: N + 1 }, (_, i) => a + ((b - a) * i) / N)
  const curve = pts(domain[0], domain[1])
    .map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(f(v)).toFixed(1)}`)
    .join('')
  const a = clamp(lo, domain[0], domain[1])
  const b = clamp(hi, domain[0], domain[1])
  const area = `M${x(a).toFixed(1)},${y(0).toFixed(1)}` + pts(a, b).map((v) => `L${x(v).toFixed(1)},${y(f(v)).toFixed(1)}`).join('') + `L${x(b).toFixed(1)},${y(0).toFixed(1)}Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={[0, peak * 1.2]} H={H} m={m} xTitle={xTitle} yTicks={[]} grid={false} />
      <path d={area} fill={fill} stroke="none" />
      <path d={curve} fill="none" stroke={color} strokeWidth={2} />
      {[lo, hi].map((v) => (
        <line key={v} x1={x(clamp(v, domain[0], domain[1]))} x2={x(clamp(v, domain[0], domain[1]))} y1={y(0)} y2={y(f(v)) - 4} stroke={color} strokeWidth={1.2} />
      ))}
      <text x={(x(a) + x(b)) / 2} y={y(f(mean)) + 26} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
        {areaLabel}
      </text>
      {marks.map((mk) => (
        <g key={mk.label}>
          <line x1={x(clamp(mk.at, domain[0], domain[1]))} x2={x(clamp(mk.at, domain[0], domain[1]))} y1={m.t - 6} y2={y(0)} stroke={mk.color} strokeWidth={1.4} strokeDasharray={mk.dash} />
          <text x={x(clamp(mk.at, domain[0], domain[1]))} y={m.t - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill={mk.color}>
            {mk.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
