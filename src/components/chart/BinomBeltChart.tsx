// E02 이항 신뢰띠: 가로축 p₀, 세로축 x (정수). x마다의 구간 막대를 쌓은 것이 계단형 신뢰띠다.
// 세로로 자르면 채택역 A(p₀) (점들), 가로로 자르면 신뢰구간 C(x) (막대 하나).
import type { Ref } from 'react'
import type { Interval } from '../../engine/meanInterval'
import { Axes, W, clamp, makeScales } from './frame'

interface Props {
  n: number
  belt: Interval[]
  /** 비교용으로 겹쳐 그릴 다른 검정의 띠 (윤곽선만) */
  compare?: { belt: Interval[]; color: string; label: string }[]
  stage: number
  /** 세로 단면 위치 (1–3단계 p₀, 4단계 p*) */
  slice: number
  accept: boolean[]
  xObs: number
  /** 4단계: x별 반복표집 도수 */
  freq?: number[]
  svgRef?: Ref<SVGSVGElement>
  ariaLabel: string
}

const STACK = 21

export function BinomBeltChart({ n, belt, compare = [], stage, slice, accept, xObs, freq, svgRef, ariaLabel }: Props) {
  const H = 440
  const m = { l: 56, r: 16, t: 22, b: 44 }
  const { x, y } = makeScales([0, 1], [-0.5, n + 0.5], H, m)
  const cx = (v: number) => x(clamp(v, 0, 1))
  const unit = Math.abs(y(1) - y(0))
  const barH = Math.max(2, Math.min(unit * 0.62, 18))
  const dotR = Math.max(2, Math.min(5, unit * 0.32))
  const step = n <= 12 ? 1 : n <= 30 ? 5 : 10
  const yTicks = Array.from({ length: n + 1 }, (_, k) => k).filter((k) => k % step === 0 || k === n)
  const maxFreq = freq ? Math.max(1, ...freq) : 1
  const stackPs = Array.from({ length: STACK }, (_, i) => (i + 0.5) / STACK)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <Axes x={x} y={y} xDomain={[0, 1]} yDomain={[-0.5, n + 0.5]} H={H} m={m} xTitle="가설값 p₀ (모수)" yTitle="관측 x (성공 수)" yTicks={yTicks} xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]} />

      {/* 2단계: x마다의 구간 막대 = 띠 */}
      {stage >= 2 &&
        belt.map((iv, k) => (
          <rect key={k} className="belt-band" x={cx(iv.lower)} width={Math.max(1, cx(iv.upper) - cx(iv.lower))} y={y(k) - barH / 2} height={barH} rx={2} fill="var(--c-accept-fill)" stroke="var(--c-accept)" strokeWidth={0.7} />
        ))}
      {stage >= 2 &&
        compare.map((c) =>
          c.belt.map((iv, k) => <rect key={`${c.label}${k}`} x={cx(iv.lower)} width={Math.max(1, cx(iv.upper) - cx(iv.lower))} y={y(k) - barH / 2} height={barH} rx={2} fill="none" stroke={c.color} strokeWidth={1.4} strokeDasharray="4 3" />),
        )}
      {/* 2단계: 여러 p₀의 채택역(점)을 쌓는 장면 */}
      {stage === 2 &&
        stackPs.map((p, i) => (
          <g key={p} className="belt-seg" style={{ animationDelay: `${i * 60}ms` }}>
            {belt.map((iv, k) => (iv.lower <= p && p <= iv.upper ? <circle key={k} cx={x(p)} cy={y(k)} r={Math.max(1.4, dotR * 0.55)} fill="var(--c-accept)" /> : null))}
          </g>
        ))}

      {/* 세로 단면: A(slice) */}
      <line x1={x(slice)} x2={x(slice)} y1={m.t} y2={H - m.b} stroke={stage >= 4 ? 'var(--c-truth)' : 'var(--c-mu0)'} strokeWidth={stage >= 4 ? 2 : 1.3} strokeDasharray={stage >= 4 ? undefined : '5 4'} />
      {accept.map((a, k) =>
        a ? (
          <circle key={k} cx={x(slice)} cy={y(k)} r={dotR} fill="var(--c-mu0)" />
        ) : (
          <circle key={k} cx={x(slice)} cy={y(k)} r={dotR * 0.75} fill="none" stroke="var(--c-reject)" strokeWidth={1} opacity={0.6} />
        ),
      )}
      <text x={x(slice) > W - 190 ? x(slice) - 8 : x(slice) + 8} y={m.t - 8} textAnchor={x(slice) > W - 190 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={stage >= 4 ? 'var(--c-truth)' : 'var(--c-mu0)'}>
        {stage >= 4 ? `참값 p* = ${slice} (고정) · 채운 점 = A(p*)` : '세로 단면 = 채택역 A(p₀) (채운 점)'}
      </text>

      {/* 3단계: 관측 x의 가로 단면 = 신뢰구간 */}
      {stage === 3 && (
        <g>
          <line x1={m.l} x2={W - m.r} y1={y(xObs)} y2={y(xObs)} stroke="var(--c-obs)" strokeWidth={1} strokeDasharray="5 4" />
          <rect x={cx(belt[xObs].lower)} width={Math.max(2, cx(belt[xObs].upper) - cx(belt[xObs].lower))} y={y(xObs) - barH / 2 - 1} height={barH + 2} rx={3} fill="var(--c-obs)" opacity={0.85} />
          {belt[xObs].lower < 0 && <text x={x(0) + 4} y={y(xObs) - barH / 2 - 4} fontSize={10} fill="var(--c-miss)">◀ 0 밖으로</text>}
          {belt[xObs].upper > 1 && <text x={x(1) - 4} y={y(xObs) - barH / 2 - 4} fontSize={10} fill="var(--c-miss)" textAnchor="end">1 밖으로 ▶</text>}
          <text x={(cx(belt[xObs].lower) + cx(belt[xObs].upper)) / 2} y={y(xObs) - barH / 2 - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--c-obs)">
            가로 단면 = 신뢰구간 C(x = {xObs})
          </text>
        </g>
      )}

      {/* 4단계: x별 도수 막대 (p* 선 오른쪽) */}
      {stage >= 4 &&
        freq?.map((f, k) => {
          if (!f) return null
          const len = (Math.min(150, W - m.r - x(slice) - 40) * f) / maxFreq
          const ok = accept[k]
          return (
            <g key={k}>
              <rect x={x(slice) + dotR + 3} width={Math.max(1, len)} y={y(k) - barH * 0.3} height={barH * 0.6} fill={ok ? 'var(--c-cover-fill)' : 'var(--c-miss)'} stroke={ok ? 'var(--c-cover)' : 'var(--c-miss)'} strokeWidth={0.8} opacity={ok ? 1 : 0.55} />
              <text x={x(slice) + dotR + 6 + len} y={y(k) + 4} fontSize={10} fill={ok ? 'var(--c-text-secondary)' : 'var(--c-miss)'} fontWeight={ok ? 400 : 700}>
                {f}
                {ok ? '' : ' ✕'}
              </text>
            </g>
          )
        })}
    </svg>
  )
}
