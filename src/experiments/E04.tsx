// E04 검정 역산과 p-값 함수 (PRD v2 §7 E04) — 정규평균(σ 알려짐)과 이항
import { useEffect, useRef, useState } from 'react'
import { contains, criticalValue, meanInterval, meanTest, standardError, type Alt } from '../engine/meanInterval'
import { DensityChart } from '../components/chart/DensityChart'
import { PFunctionChart } from '../components/chart/PFunctionChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { fmtNum, niceStep } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { LIMITS, type LabState, type Update } from '../state/labState'
import { E04Binom } from './E04Binom'
import { ModelSwitch } from './ModelSwitch'

const fmtBound = (v: number) => (v === Infinity ? '∞' : v === -Infinity ? '−∞' : fmtNum(v, 4))

const ALT_LABEL: Record<Alt, string> = { two: 'H₁: μ ≠ μ₀', greater: 'H₁: μ > μ₀', less: 'H₁: μ < μ₀' }

/** E04: 정규평균 z 검정과 이항 검정의 p-값 함수 */
export function E04({ s, update }: { s: LabState; update: Update }) {
  return (
    <>
      <ModelSwitch s={s} update={update} />
      {s.model === 'binom' ? <E04Binom s={s} update={update} /> : <E04Normal s={s} update={update} />}
    </>
  )
}

function E04Normal({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const [nested, setNested] = useState(false)
  const se = standardError(s.sigma, s.n)
  const domain: [number, number] = [s.xbar - 5 * se, s.xbar + 5 * se]
  const step = niceStep(se / 20)
  const mu0 = Math.min(domain[1], Math.max(domain[0], s.mu0))
  const alpha = 1 - s.level
  const test = meanTest('z', s.xbar, s.sigma, s.n, mu0, s.alt)
  const ci = meanInterval('z', s.xbar, s.sigma, s.n, s.level, s.alt)
  const reject = test.p < alpha
  const inCI = contains(ci, mu0)
  const q = criticalValue('z', s.level, s.n, s.alt)

  // 결정이 한 번이라도 바뀌면 예상의 답을 공개한다
  const first = useRef(reject)
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    if (reject !== first.current) setFlipped(true)
  }, [reject])

  const nudge = (d: number) => update((cur) => ({ mu0: Math.min(domain[1], Math.max(domain[0], Number((cur.mu0 + d * step).toFixed(10)))) }))
  useShortcuts({ ArrowRight: () => nudge(4), ArrowLeft: () => nudge(-4) }, present)

  return (
    <>
      <Predict
        experimentId="E04"
        itemId="E04-P1"
        question={`x̄ = ${s.xbar}, σ = ${s.sigma}, n = ${s.n}. μ₀를 움직이면 기각 결정은 어디서 바뀔까요?`}
        choices={[
          { text: `${Math.round(s.level * 1000) / 10}% 신뢰구간의 끝점에서`, correct: true, feedback: '기각하지 않는 μ₀를 모두 모은 것이 신뢰구간이므로, 결정이 바뀌는 경계가 곧 구간의 끝점입니다. 끝점에서 p-값은 정확히 α입니다.' },
          { text: 'μ₀ = x̄ ± σ에서', misconception: 'M4', feedback: '경계는 σ가 아니라 표준오차 σ/√n과 임계값 q로 정해집니다: x̄ ± q·σ/√n.' },
          { text: 'μ₀가 x̄와 같아질 때', misconception: 'M10', feedback: 'μ₀ = x̄이면 p = 1로 가장 기각하기 어렵습니다. 결정은 x̄에서 충분히 멀어질 때 바뀝니다.' },
          { text: '결정이 바뀌는 경계는 없다', misconception: 'M4', feedback: '|x̄ − μ₀|가 q·SE를 넘으면 기각, 넘지 않으면 기각하지 않습니다. 경계가 분명히 있습니다.' },
        ]}
        revealed={flipped}
        waitHint="μ₀ 슬라이더를 움직여 결정이 바뀌는 순간을 찾아보세요."
        resultSummary={`경계는 [${fmtBound(ci.lower)}, ${fmtBound(ci.upper)}]의 끝점입니다.`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>관측 자료와 검정</h2>
          <SliderField label="관측 x̄" value={s.xbar} min={-1000} max={1000} step={0.1} onChange={(xbar) => update({ xbar })} />
          <SliderField label="모표준편차 σ (알려짐)" value={s.sigma} min={0.5} max={100} step={0.5} onChange={(sigma) => update({ sigma })} />
          <SliderField label="표본크기 n" value={s.n} min={LIMITS.n[0]} max={200} step={1} onChange={(n) => update({ n })} />
          <SliderField label="신뢰수준 1−α (유의수준 α)" value={s.level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(level) => update({ level })} format={(v) => `${(v * 100).toFixed(1)}% (α = ${Number((1 - v).toFixed(4))})`} />
          <Segmented<Alt>
            label="대립가설 ↔ 구간"
            value={s.alt}
            options={[
              { value: 'two', label: '≠ ↔ 양측' },
              { value: 'greater', label: '> ↔ 하한' },
              { value: 'less', label: '< ↔ 상한' },
            ]}
            onChange={(alt) => update({ alt })}
          />
          <SliderField label="가설값 μ₀" value={mu0} min={domain[0]} max={domain[1]} step={step} onChange={(v) => update({ mu0: v })} format={(v) => fmtNum(v, 3)} />
          <label className="row" style={{ gap: 8, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={nested} onChange={(e) => setNested(e.target.checked)} />
            여러 신뢰수준 겹쳐 보기 (신뢰 곡선)
          </label>
          <AssumptionBadges items={['정규 모집단', '독립 표본', 'σ 알려짐']} />
          <p className="field-hint">기각 규칙: p &lt; α이면 기각합니다. 그래서 끝점(p = α)은 구간에 포함되고, 구간은 닫힌 구간입니다.</p>
        </aside>

        <section className="col-chart panel chart-panel" aria-label="검정과 구간">
          <div className={`verdict ${reject ? 'reject' : 'keep'}`} role="status" aria-live="polite">
            H₀: μ = {fmtNum(mu0, 3)} vs {ALT_LABEL[s.alt]} · z = {fmtNum(test.stat, 4)} · p = {test.p < 1e-4 ? test.p.toExponential(3) : test.p.toFixed(4)} → {reject ? `기각 (p < α = ${Number(alpha.toFixed(4))})` : `기각하지 않음 (p ≥ α = ${Number(alpha.toFixed(4))})`}
          </div>
          <div className="duality">
            <span>{reject ? 'H₀ 기각' : 'H₀ 기각하지 않음'}</span>
            <span className="eq">⟺</span>
            <span>
              μ₀ = {fmtNum(mu0, 3)} {inCI ? '∈' : '∉'} [{fmtBound(ci.lower)}, {fmtBound(ci.upper)}]
            </span>
          </div>

          <h3 className="chart-title">p-값 함수 p(μ₀): 높이 α에서 자르면 신뢰구간</h3>
          <PFunctionChart svgRef={svgRef} xbar={s.xbar} sigma={s.sigma} n={s.n} level={s.level} alt={s.alt} mu0={mu0} domain={domain} nested={nested} ariaLabel={`p-값 함수. 현재 μ₀ = ${fmtNum(mu0, 3)}에서 p = ${test.p.toFixed(4)}. α 선과 만나는 점이 구간 [${fmtBound(ci.lower)}, ${fmtBound(ci.upper)}]의 끝점`} />
          <Legend
            items={[
              { color: 'var(--c-pval)', label: 'p-값 함수' },
              { color: 'var(--c-reject)', label: 'α 선', pattern: 'line' },
              { color: 'var(--c-obs)', label: '신뢰구간 (α 선 위의 구간)', pattern: 'fill' },
              { color: 'var(--c-mu0)', label: '현재 μ₀', pattern: 'line' },
            ]}
          />

          <h3 className="chart-title">7장의 그림: H₀: μ = μ₀에서 X̄의 표본분포</h3>
          <DensityChart mu0={mu0} se={se} level={s.level} alt={s.alt} domain={domain} observed={s.xbar} showP ariaLabel={`귀무분포 N(${fmtNum(mu0, 3)}, ${fmtNum(se, 3)}²), 관측 x̄ = ${s.xbar}, p-값 영역`} />
          <Legend
            items={[
              { color: 'var(--c-reject)', label: '기각역', pattern: 'hatch' },
              { color: 'var(--c-pval)', label: 'p-값 영역', pattern: 'fill' },
              { color: 'var(--c-obs)', label: '관측 x̄', pattern: 'fill' },
            ]}
          />

          <StatGrid
            stats={[
              { tag: '신뢰구간', label: `${(s.level * 100).toFixed(1)}%`, value: `[${fmtBound(ci.lower)}, ${fmtBound(ci.upper)}]` },
              { tag: '끝점에서의 p-값', label: '= α', value: Number.isFinite(ci.lower) ? meanTest('z', s.xbar, s.sigma, s.n, ci.lower, s.alt).p.toFixed(6) : meanTest('z', s.xbar, s.sigma, s.n, ci.upper, s.alt).p.toFixed(6) },
              { tag: '임계값', label: s.alt === 'two' ? 'Q₁₋α/₂' : 'Q₁₋α', value: q.toFixed(6), tone: 'orange' },
            ]}
          />
          <ExportBar s={s} update={update} experimentId="E04" svgRef={svgRef} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> μ₀ 이동
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.7 식 (8.54)–(8.59) · p.322–323 · 7.5 유의성 검정</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>신뢰구간 = 기각되지 않는 μ₀의 모임</h2>
          <ExplainTabs
            intuition={
              <>
                <p>μ₀를 하나씩 바꿔 가며 같은 자료로 검정을 반복한다고 생각해 보세요. 기각되지 않는 μ₀들을 모으면 구간이 됩니다.</p>
                <p>p-값 함수는 그 검정들의 p-값을 한 줄로 그린 것입니다. α 선 위에 있는 부분이 신뢰구간이고, α를 바꾸면 수평선이 움직이며 다른 수준의 구간이 나옵니다.</p>
                <p className="muted">‘기각하지 않음’은 ‘μ₀가 참임을 증명함’이 아닙니다. 구간 안의 값은 모두 기각되지 않았을 뿐입니다. p-값도 H₀가 참일 확률이 아닙니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`z = \frac{\bar x-\mu_0}{\sigma/\sqrt n} = \frac{${s.xbar}-${fmtNum(mu0, 3)}}{${fmtNum(se, 4)}} = ${fmtNum(test.stat, 4)}`}</Tex>
                <Tex block>{s.alt === 'two' ? String.raw`p = 2\{1-\Phi(|z|)\} = ${test.p.toFixed(6)}` : s.alt === 'greater' ? String.raw`p = 1-\Phi(z) = ${test.p.toFixed(6)}` : String.raw`p = \Phi(z) = ${test.p.toFixed(6)}`}</Tex>
                <Tex block>{String.raw`C = [${fmtBound(ci.lower)},\ ${fmtBound(ci.upper)}]`}</Tex>
              </>
            }
            proof={
              <>
                <p>양측 z 검정은 다음일 때 H₀: μ = μ₀를 기각하지 않습니다(교재 식 8.56).</p>
                <Tex block>{String.raw`\left|\frac{\bar x-\mu_0}{\sigma/\sqrt n}\right| \le Q_{1-\alpha/2}`}</Tex>
                <p>이를 μ₀에 대한 부등식으로 풀면(식 8.57)</p>
                <Tex block>{String.raw`\bar x - Q_{1-\alpha/2}\frac{\sigma}{\sqrt n} \le \mu_0 \le \bar x + Q_{1-\alpha/2}\frac{\sigma}{\sqrt n}`}</Tex>
                <p>바로 모평균의 100(1 − α)% 신뢰구간입니다(식 8.58–8.59). 단측 검정은 같은 방식으로 단측 신뢰한계를 줍니다. 교재의 상측 표기 z_(α/2)는 이 사이트의 Q_(1−α/2)와 같습니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
