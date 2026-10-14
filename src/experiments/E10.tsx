// E10 정확성: 검정력과 길이 (PRD v2 §7 E10, P1) — 정규평균
import { useMemo, useRef } from 'react'
import { randomSeed } from '../engine/core/rng'
import { tPpf } from '../engine/core/tdist'
import { expectedLength, falseCoverage, integrateFalseCoverage, powerAt } from '../engine/accuracy'
import { standardError } from '../engine/meanInterval'
import { splitTails } from '../engine/pivot'
import { FalseCoverageChart, type FcCurve } from '../components/chart/FalseCoverageChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useReplicates } from '../lib/useReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => (Number.isFinite(v) ? fmtNum(v, 4) : '∞')
const pct = (v: number, d = 2) => `${Math.round(v * 10 ** (d + 2)) / 10 ** d}%`
const MC_GRID = 61

export function E10({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const { mu: theta, sigma, n, level } = s
  const alpha = 1 - level
  const { aL, aU } = splitTails(alpha, s.ts)
  const se = standardError(sigma, n)
  const half = 6 * se
  const domain: [number, number] = [theta - half, theta + half]
  const th1 = Math.min(domain[1], Math.max(domain[0], s.th1))
  const fc = falseCoverage(theta, th1, se, aL, aU)
  const pw = powerAt(theta, th1, se, aL, aU)
  const len = expectedLength(se, aL, aU)
  const area = useMemo(() => (Number.isFinite(len) ? integrateFalseCoverage(theta, se, aL, aU) : Infinity), [theta, se, aL, aU, len])
  const equalTail = s.ts !== 0.5

  // t 구간 (σ 미지): 같은 꼬리 배분, E01 엔진의 표본으로 MC
  const reps = useReplicates({ mu: theta, sigma, n, seed: s.seed }, s.tc && s.seed >= 0 ? s.k : 0)
  const mc = useMemo(() => {
    if (!s.tc || reps.count === 0) return null
    const tqL = aL <= 0 ? -Infinity : tPpf(aL, n - 1)
    const tqU = aU <= 0 ? Infinity : tPpf(1 - aU, n - 1)
    const grid = Array.from({ length: MC_GRID }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / (MC_GRID - 1))
    const hits = new Array<number>(MC_GRID).fill(0)
    let hitTh1 = 0
    let lenSum = 0
    for (let b = 0; b < reps.count; b++) {
      const sdn = reps.s[b] / Math.sqrt(n)
      const lo = reps.xbar[b] - tqU * sdn
      const hi = reps.xbar[b] - tqL * sdn
      lenSum += hi - lo
      if (lo <= th1 && th1 <= hi) hitTh1++
      for (let i = 0; i < MC_GRID; i++) if (lo <= grid[i] && grid[i] <= hi) hits[i]++
    }
    return { points: grid.map((t, i) => [t, hits[i] / reps.count] as [number, number]), atTh1: hitTh1 / reps.count, meanLen: lenSum / reps.count }
  }, [s.tc, reps.xbar, reps.s, reps.count, aL, aU, n, th1, domain[0], domain[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  const main: FcCurve = { label: 'z 구간의 오포함확률', color: 'var(--c-cover)', f: (t) => falseCoverage(theta, t, se, aL, aU) }
  const others: FcCurve[] = equalTail ? [{ label: '등꼬리 z 구간', color: 'var(--c-text-tertiary)', f: (t) => falseCoverage(theta, t, se, alpha / 2, alpha / 2) }] : []

  const step = Math.max(0.01, Number((se / 10).toPrecision(1)))
  const nudge = (d: number) => update((c) => ({ th1: Number((c.th1 + d * step).toFixed(6)) }))
  useShortcuts({ ArrowRight: () => nudge(5), ArrowLeft: () => nudge(-5) }, present)
  const shapes = [
    { label: '등꼬리', share: 0.5 },
    { label: '1% / 4%', share: 0.2 },
    { label: '하한만', share: 0 },
    { label: '상한만', share: 1 },
  ]

  return (
    <>
      <Predict
        experimentId="E10"
        itemId="E10-P1"
        question={`참값이 θ = ${theta}이고 SE = ${fmtNum(se, 3)}일 때, 틀린 값 θ′ = ${th1}이 95% 구간에 들어갈 확률은? (그 확률은 7장의 어떤 양과 같을까?)`}
        choices={[
          { text: '0% — 틀린 값이니까 들어가지 않는다', misconception: 'M5', feedback: '구간은 θ 주변으로 폭을 가지므로 가까운 틀린 값은 자주 포함됩니다. 그 확률이 작을수록 ‘정확한’ 구간입니다.' },
          { text: `약 ${pct(falseCoverage(theta, th1, se, 0.025, 0.025), 0)} — H₀: θ = θ′ 검정이 θ에서 기각하지 못할 확률(1 − 검정력)`, correct: true, feedback: 'θ′ ∈ C(X) ⟺ X ∈ A(θ′)이므로 P_θ{θ′ ∈ C} = P_θ{H₀: θ′를 기각하지 않음} = 1 − 검정력입니다.' },
          { text: '5% — 유의수준 α', misconception: 'M4', feedback: 'α는 참값 θ′ = θ일 때 기각할 확률입니다. θ′ ≠ θ일 때의 확률은 검정력과 관계됩니다.' },
          { text: '95% — 신뢰수준', misconception: 'M1', feedback: '95%는 참값을 포함할 확률(θ′ = θ일 때)입니다.' },
        ]}
        revealed
        waitHint=""
        resultSummary={`P_θ{${th1} ∈ C} = ${fc.toFixed(4)}, H₀: θ = ${th1} 검정의 검정력 = ${pw.toFixed(4)}.`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>참값과 구간</h2>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-outline sm" onClick={() => update({ mu: 100, sigma: 25, n: 25, level: 0.95, ts: 0.5, th1: 90 })}>
              기준 (θ=100, SE=5, θ′=90)
            </button>
          </div>
          <SliderField label="참값 θ (교육용)" value={theta} min={-1000} max={1000} step={1} onChange={(v) => update((c) => ({ mu: v, th1: c.th1 - c.mu + v }))} />
          <SliderField label="σ (알려짐)" value={sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
          <SliderField label="표본크기 n" value={n} min={LIMITS.n[0]} max={200} step={1} onChange={(v) => update({ n: v })} />
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v, 1)} />
          <div className="field">
            <span className="field-label">구간 모양</span>
            <div className="row" style={{ gap: 6 }}>
              {shapes.map((sh) => (
                <button key={sh.label} type="button" className="btn-outline sm" aria-pressed={s.ts === sh.share} onClick={() => update({ ts: sh.share })}>
                  {sh.label}
                </button>
              ))}
            </div>
          </div>
          <SliderField label="다른 값 θ′" value={th1} min={domain[0]} max={domain[1]} step={step} onChange={(v) => update({ th1: v })} format={(v) => fmtNum(v, 2)} />
          <label className="row" style={{ gap: 8, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={s.tc} onChange={(e) => update({ tc: e.target.checked })} />
            σ를 모를 때(t 구간)도 겹쳐 보기 (MC)
          </label>
          {s.tc && (
            <div className="run-bar" role="group" aria-label="t 구간용 표본 뽑기">
              {[100, 1000].map((m) => (
                <button key={m} type="button" className="btn-outline sm" onClick={() => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + m), seed: c.seed < 0 ? randomSeed() : c.seed }))}>
                  {m.toLocaleString('ko-KR')}회
                </button>
              ))}
              <span className="kbd-help">반복 {fmtInt(reps.count)}회</span>
            </div>
          )}
          <AssumptionBadges items={['정규 모집단', '독립 표본', 'z: σ 알려짐']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="오포함확률과 검정력">
          <h3 className="chart-title" style={{ marginTop: 0 }}>
            오포함확률 곡선 = 1 − 검정력, 그 아래 넓이 = 기대 길이
          </h3>
          <FalseCoverageChart
            svgRef={svgRef}
            domain={domain}
            theta={theta}
            thetaPrime={th1}
            main={main}
            check={(t) => 1 - powerAt(theta, t, se, aL, aU)}
            others={others}
            mc={mc ? { label: 't 구간 (MC)', color: 'var(--c-miss)', points: mc.points } : undefined}
            ariaLabel={`참값 ${theta}에서 θ′마다 구간이 θ′를 포함할 확률. θ′ = ${th1}에서 ${fc.toFixed(4)}, 곡선 아래 넓이 ${f4(area)}`}
          />
          <div className="chart-legend">
            <span>
              <span className="legend-swatch" style={{ background: 'var(--c-cover)' }} />z 구간의 오포함확률 (칠한 넓이 = 기대 길이)
            </span>
            <span>○ 1 − H₀: θ = θ′ 검정의 검정력 (따로 계산)</span>
            {equalTail && <span>회색 점선: 등꼬리 z 구간</span>}
            {mc && <span style={{ color: 'var(--c-miss)' }}>주황 점선: t 구간 (σ 미지, MC {fmtInt(reps.count)}회)</span>}
          </div>

          <StatGrid
            stats={[
              { tag: `P_θ{θ′ = ${fmtNum(th1, 2)} ∈ C}`, label: '오포함확률', value: fc.toFixed(4), sub: mc ? `t 구간 MC ${mc.atTh1.toFixed(4)}` : undefined },
              { tag: `H₀: θ = ${fmtNum(th1, 2)} 검정의 검정력`, label: '참값 θ에서', value: pw.toFixed(4), tone: 'orange', sub: `합 = ${(fc + pw).toFixed(4)}` },
              { tag: '곡선 아래 넓이', label: `= 기대 길이 ${f4(len)}`, value: f4(area), sub: mc ? `t 구간 MC 평균 길이 ${f4(mc.meanLen)}` : Number.isFinite(len) ? undefined : '한쪽 구간은 길이 ∞' },
            ]}
          />
          <p className="chart-caption">
            θ′ = θ에서 곡선의 높이는 포함률 {pct(1 - alpha, 1)}입니다. θ′가 θ에서 멀어질수록 빨리 떨어지는 구간이 ‘정확한’ 구간이고, 그런 구간은 짧습니다.{' '}
            {equalTail && Number.isFinite(len) ? `지금 배분의 기대 길이 ${f4(len)}는 등꼬리 ${f4(expectedLength(se, alpha / 2, alpha / 2))}보다 깁니다.` : ''}
            {!Number.isFinite(len) ? '한쪽 구간은 반대쪽의 모든 θ′를 언제나 포함하므로(곡선이 1로 감) 길이가 무한이지만, 자기 쪽에서는 양측 구간보다 틀린 값을 덜 포함합니다(가장 정확한 한쪽 한계).' : ''}
          </p>
          <ExportBar s={s} update={update} experimentId="E10" svgRef={svgRef} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> θ′ 이동
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 7.2(검정력) · 8.7 · 확장: CB 9.3</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>짧은 구간 = 강력한 검정</h2>
          <ExplainTabs
            intuition={
              <>
                <p>구간이 틀린 값 θ′를 포함한다는 것은, 그 자료로 H₀: θ = θ′를 기각하지 못했다는 뜻입니다. 그래서 틀린 값을 덜 포함하는 구간은 틀린 귀무가설을 더 잘 기각하는 검정, 곧 검정력이 높은 검정을 뒤집은 것입니다.</p>
                <p>σ를 모르면 t 구간을 써야 하고, 검정력이 낮아진 만큼 틀린 값을 더 자주 포함하며 평균적으로 더 깁니다(‘t 구간도 겹쳐 보기’).</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`P_\theta\{\theta' \in C\} = \Phi\!\left(\tfrac{\theta'-\theta}{\mathrm{SE}} + Q_{1-\alpha_U}\right) - \Phi\!\left(\tfrac{\theta'-\theta}{\mathrm{SE}} + Q_{\alpha_L}\right)`}</Tex>
                <p>
                  θ = {theta}, θ′ = {fmtNum(th1, 2)}, SE = {fmtNum(se, 4)}: {fc.toFixed(7)}
                </p>
                <Tex block>{String.raw`\int P_\theta\{\theta' \in C\}\,d\theta' = ${f4(area)},\quad (Q_{1-\alpha_U}-Q_{\alpha_L})\,\mathrm{SE} = ${f4(len)}`}</Tex>
              </>
            }
            proof={
              <>
                <p>
                  <strong>쌍대성.</strong> C(x) = {'{'}θ′ : x ∈ A(θ′){'}'}이면 {'{'}θ′ ∈ C(X){'}'} = {'{'}X ∈ A(θ′){'}'}이므로
                </p>
                <Tex block>{String.raw`P_\theta\{\theta' \in C(X)\} = 1 - \beta_{\theta'}(\theta)`}</Tex>
                <p>여기서 β_θ′(θ)는 H₀: θ = θ′ 검정의 θ에서의 검정력입니다.</p>
                <p>
                  <strong>Pratt 항등식.</strong> 길이(C) = ∫ 1{'{'}θ′ ∈ C{'}'} dθ′이므로 기댓값과 적분의 순서를 바꾸면(Fubini)
                </p>
                <Tex block>{String.raw`E_\theta[\text{길이}(C)] = \int P_\theta\{\theta' \in C(X)\}\,d\theta'`}</Tex>
                <p>한 점 θ′ = θ는 넓이에 기여하지 않으므로, 기대 길이를 줄이는 것은 모든 θ′ ≠ θ에서 오포함확률을 줄이는 것, 곧 검정력을 높이는 것과 같습니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
