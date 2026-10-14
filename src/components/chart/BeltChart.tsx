// E02 신뢰띠 (네이만 구성). 검정 실험실의 BeltChart와 같은 방향:
// 가로축 = 가설값 μ₀, 세로축 = 관측 x̄. 세로로 자르면 채택역 A(μ₀), 가로로 자르면 신뢰구간 C(x̄).
import type { Ref } from 'react'
import { acceptanceRegion, contains, meanInterval, type Alt } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'

export interface BeltPoint {
  b: number
  xbar: number
}

interface Props {
  domain: [number, number]
  se: number
  level: number
  alt: Alt
  stage: number
  mu0: number
  xbarObs: number
  truth: number
  points: BeltPoint[]
  selected: number
  onSelect: (b: number) => void
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

const STACK = 15

export function BeltChart({ domain, se, level, alt, stage, mu0, xbarObs, truth, points, selected, onSelect, svgRef, ariaLabel }: Props) {
  const H = 440
  const m = { l: 56, r: 16, t: 14, b: 44 }
  const { x, y } = makeScales(domain, domain, H, m)
  const cy = (v: number) => y(clamp(v, domain[0], domain[1]))
  const cx = (v: number) => x(clamp(v, domain[0], domain[1]))

  const N = 160
  const ts = Array.from({ length: N + 1 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / N)
  const A = (t: number) => acceptanceRegion(t, se, level, alt)
  const bandPath = ts.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${cy(A(t).upper).toFixed(1)}`).join('') + [...ts].reverse().map((t) => `L${x(t).toFixed(1)},${cy(A(t).lower).toFixed(1)}`).join('') + 'Z'
  const stackTs = Array.from({ length: STACK }, (_, i) => domain[0] + ((domain[1] - domain[0]) * (i + 0.5)) / STACK)

  // 4단계에서는 참값 μ*의 세로 단면 A(μ*)를 본다
  const sliceAt = stage >= 4 ? truth : mu0
  const acc = A(sliceAt)
  const ci = meanInterval('z', xbarObs, se, 1, level, alt)
  const inside = contains(acc, xbarObs)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={domain} yDomain={domain} H={H} m={m} xTitle="가설값 μ₀ (모수)" yTitle="관측 x̄ (통계량)" />

      {/* 2단계: 모든 μ₀의 채택역을 쌓은 띠 */}
      {stage >= 2 && <path d={bandPath} fill="var(--c-accept-fill)" stroke="var(--c-accept)" strokeWidth={1} className="belt-band" />}
      {stage === 2 &&
        stackTs.map((t, i) => (
          <line key={t} className="belt-seg" style={{ animationDelay: `${i * 70}ms` }} x1={x(t)} x2={x(t)} y1={cy(A(t).lower)} y2={cy(A(t).upper)} stroke="var(--c-accept)" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
        ))}

      {/* 1단계부터: μ₀ 하나의 채택역 (세로 단면) */}
      <line x1={x(sliceAt)} x2={x(sliceAt)} y1={m.t} y2={H - m.b} stroke="var(--c-mu0)" strokeWidth={1.3} strokeDasharray="5 4" />
      <line x1={x(sliceAt)} x2={x(sliceAt)} y1={cy(acc.lower)} y2={cy(acc.upper)} stroke="var(--c-mu0)" strokeWidth={stage >= 4 ? 22 : 7} strokeLinecap="round" opacity={stage >= 4 ? 0.22 : 0.85} />
      <text x={x(sliceAt) > W - 170 ? x(sliceAt) - 8 : x(sliceAt) + 8} y={m.t + 12} textAnchor={x(sliceAt) > W - 170 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill="var(--c-mu0)">
        {stage >= 4 ? '세로 단면 = 채택역 A(μ*)' : '세로 단면 = 채택역 A(μ₀)'}
      </text>

      {/* 3단계: 관측 x̄의 가로 단면 = 신뢰구간 */}
      {stage === 3 && (
        <g>
          <line x1={m.l} x2={W - m.r} y1={cy(xbarObs)} y2={cy(xbarObs)} stroke="var(--c-obs)" strokeWidth={1.2} strokeDasharray="5 4" />
          <line x1={cx(ci.lower)} x2={cx(ci.upper)} y1={cy(xbarObs)} y2={cy(xbarObs)} stroke="var(--c-obs)" strokeWidth={6} strokeLinecap="round" />
          <text x={(cx(ci.lower) + cx(ci.upper)) / 2} y={cy(xbarObs) - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--c-obs)">
            가로 단면 = 신뢰구간 C(x̄)
          </text>
          {/* 교차점: 띠 안이면 기각하지 않음 */}
          {inside ? <circle cx={x(mu0)} cy={cy(xbarObs)} r={6} fill="var(--c-cover)" stroke="#fff" strokeWidth={1.5} /> : <text x={x(mu0)} y={cy(xbarObs) + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--c-miss)">✕</text>}
        </g>
      )}

      {/* 4단계: 참값 μ*에서 뽑은 표본의 x̄은 모두 μ* 세로선 위에 떨어진다 */}
      {stage >= 4 && (
        <g>
          <line x1={x(truth)} x2={x(truth)} y1={m.t} y2={H - m.b} stroke="var(--c-truth)" strokeWidth={2.2} />
          <text x={x(truth) + 6} y={H - m.b - 8} fontSize={11} fontWeight={600} fill="var(--c-truth)">
            참값 μ* = {truth} (고정)
          </text>
          {points.map((p) => {
            const ok = contains(A(truth), p.xbar)
            const sel = p.b === selected
            return (
              <g key={p.b} onClick={() => onSelect(p.b)} style={{ cursor: 'pointer' }}>
                <line x1={x(truth) - 9} x2={x(truth) + 9} y1={cy(p.xbar)} y2={cy(p.xbar)} stroke={ok ? 'var(--c-cover)' : 'var(--c-miss)'} strokeWidth={sel ? 3 : ok ? 1.2 : 2} opacity={sel ? 1 : 0.7} />
                {!ok && (
                  <text x={x(truth) + 13} y={cy(p.xbar) + 4} fontSize={10} fontWeight={700} fill="var(--c-miss)" aria-hidden="true">
                    ✕
                  </text>
                )}
              </g>
            )
          })}
          {(() => {
            const p = points.find((q) => q.b === selected)
            if (!p) return null
            const c = meanInterval('z', p.xbar, se, 1, level, alt)
            const ok = contains(c, truth)
            return (
              <g>
                <line x1={cx(c.lower)} x2={cx(c.upper)} y1={cy(p.xbar)} y2={cy(p.xbar)} stroke={ok ? 'var(--c-cover)' : 'var(--c-miss)'} strokeWidth={4} strokeLinecap="round" />
                <text x={cx(c.upper) + 6 > W - 120 ? cx(c.lower) - 6 : cx(c.upper) + 6} y={cy(p.xbar) + 4} textAnchor={cx(c.upper) + 6 > W - 120 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={ok ? 'var(--c-cover)' : 'var(--c-miss)'}>
                  #{p.b + 1}의 구간
                </text>
              </g>
            )
          })()}
        </g>
      )}
    </svg>
  )
}
