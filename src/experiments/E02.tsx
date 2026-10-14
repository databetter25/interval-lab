// E02 채택역에서 신뢰띠로 — 네이만 구성 (PRD v2 §7 E02)
import { useMemo, useRef } from 'react'
import { randomSeed } from '../engine/core/rng'
import { acceptanceRegion, contains, criticalValue, meanInterval, meanTest, standardError, type Alt } from '../engine/meanInterval'
import { coverage, mcSe } from '../engine/repeat'
import { BeltChart, type BeltPoint } from '../components/chart/BeltChart'
import { DensityChart } from '../components/chart/DensityChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { replicatesCsv } from '../lib/exports'
import { fmtInt, fmtNum, niceStep } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useReplicates } from '../lib/useReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'
import { E02Binom } from './E02Binom'
import { ModelSwitch } from './ModelSwitch'
import { StageSteps } from './StageSteps'

const STAGES = [
  { n: 1, title: '검정 하나', desc: 'μ₀ 하나의 채택역' },
  { n: 2, title: '띠 쌓기', desc: '모든 μ₀의 채택역' },
  { n: 3, title: '가로로 자르기', desc: '관측 x̄ → 구간' },
  { n: 4, title: '반복표집', desc: '참값에서 표본 뽑기' },
]

const fmtBound = (v: number) => (v === Infinity ? '∞' : v === -Infinity ? '−∞' : fmtNum(v, 4))
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')

/** E02: 정규평균(연속 띠)과 이항 모비율(계단 띠) */
export function E02({ s, update }: { s: LabState; update: Update }) {
  return (
    <>
      <ModelSwitch s={s} update={update} />
      {s.model === 'binom' ? <E02Binom s={s} update={update} /> : <E02Normal s={s} update={update} />}
    </>
  )
}

function E02Normal({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const se = standardError(s.sigma, s.n)
  const domain: [number, number] = [s.mu - 5 * se, s.mu + 5 * se]
  const step = niceStep(se / 20)
  const snap = (v: number) => Math.min(domain[1], Math.max(domain[0], v))
  const mu0 = snap(s.mu0)
  const xbar = snap(s.xbar)
  const stage = s.stage

  const gen = { mu: s.mu, sigma: s.sigma, n: s.n, seed: s.seed }
  const reps = useReplicates(gen, stage >= 4 && s.seed >= 0 ? s.k : 0)
  const count = reps.count
  // 신뢰띠는 σ를 아는 z 검정으로 그린다 (E01이 t여도 여기서는 z)
  const { xbar: repX, s: repS } = reps
  const { level, alt, sigma, n, mu } = s
  const stats = useMemo(() => coverage({ method: 'z', level, alt, sigma, n }, { xbar: repX, s: repS }, mu, count), [repX, repS, count, level, alt, sigma, n, mu])
  const points: BeltPoint[] = []
  for (let b = Math.max(0, count - s.show); b < count; b++) points.push({ b, xbar: reps.xbar[b] })

  const acc = acceptanceRegion(mu0, se, s.level, s.alt)
  const ci = meanInterval('z', xbar, s.sigma, s.n, s.level, s.alt)
  const inBand = contains(acc, xbar)
  const test = meanTest('z', xbar, s.sigma, s.n, mu0, s.alt)
  const q = criticalValue('z', s.level, s.n, s.alt)

  const draw = (m: number) => update((cur) => ({ k: Math.min(LIMITS.k[1], cur.k + m), seed: cur.seed < 0 ? randomSeed() : cur.seed }))
  const goStage = (n: number) => update({ stage: Math.min(4, Math.max(1, n)) })
  const stepStage = (d: number) => update((cur) => ({ stage: Math.min(4, Math.max(1, cur.stage + d)) }))
  useShortcuts({ ArrowRight: () => stepStage(1), ArrowLeft: () => stepStage(-1), Space: () => stage >= 4 && draw(1), h: () => update((cur) => ({ hide: !cur.hide })) }, present)

  const altOptions: { value: Alt; label: string }[] = [
    { value: 'two', label: '양측' },
    { value: 'greater', label: '하한만' },
    { value: 'less', label: '상한만' },
  ]
  const err = mcSe(stats.covered, count)

  return (
    <>
      <Predict
        experimentId="E02"
        itemId="E02-P1"
        question="μ₀마다 7장의 z 검정 채택역을 구해 모두 쌓으면 어떤 모양이 될까요?"
        choices={[
          { text: '기울기 1인 평행한 두 직선 사이의 띠', correct: true, feedback: '채택역은 [μ₀ − q·SE, μ₀ + q·SE]라서 μ₀가 1 커지면 위아래 끝도 1씩 올라갑니다. 폭 2q·SE는 μ₀와 상관없이 일정합니다.' },
          { text: '높이가 일정한 수평 띠', misconception: 'M4', feedback: '채택역의 중심은 μ₀이므로 μ₀를 따라 움직입니다. 띠는 기울어져 있습니다.' },
          { text: 'μ₀가 x̄에서 멀어질수록 넓어지는 깔때기', misconception: 'M4', feedback: 'σ를 아는 z 검정에서 채택역의 폭은 2q·SE로 늘 같습니다.' },
          { text: '쌓아도 특별한 모양이 생기지 않는다', misconception: 'M4', feedback: '쌓인 채택역은 연속된 띠가 되고, 그 띠를 가로로 자른 것이 바로 신뢰구간입니다.' },
        ]}
        revealed={stage >= 2}
        waitHint="‘2 띠 쌓기’ 단계로 넘어가 확인하세요."
        resultSummary="띠의 위아래 경계는 x̄ = μ₀ ± q·SE입니다."
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>설정</h2>
          <SliderField label="참값 μ* (교육용)" value={s.mu} min={-1000} max={1000} step={1} onChange={(mu) => update({ mu, mu0: mu, xbar: mu })} />
          <SliderField label="모표준편차 σ" value={s.sigma} min={0.5} max={100} step={0.5} onChange={(sigma) => update({ sigma })} />
          <SliderField label="표본크기 n" value={s.n} min={LIMITS.n[0]} max={200} step={1} onChange={(n) => update({ n })} />
          <SliderField label="신뢰수준 1−α" value={s.level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(level) => update({ level })} format={(v) => pct(v)} />
          <Segmented<Alt> label="검정·구간 형태" value={s.alt} options={altOptions} onChange={(alt) => update({ alt })} />
          <SliderField label="가설값 μ₀ (세로 단면)" value={mu0} min={domain[0]} max={domain[1]} step={step} onChange={(v) => update({ mu0: v })} format={(v) => fmtNum(v, 3)} disabled={stage >= 4} disabledReason="4단계에서는 참값 μ*의 세로 단면을 봅니다." />
          <SliderField label="관측 x̄ (가로 단면)" value={xbar} min={domain[0]} max={domain[1]} step={step} onChange={(v) => update({ xbar: v })} format={(v) => fmtNum(v, 3)} disabled={stage !== 3} disabledReason={stage < 3 ? '3단계에서 움직일 수 있습니다.' : '4단계에서는 반복표집한 x̄들을 봅니다.'} />
          <AssumptionBadges items={['정규 모집단', '독립 표본', 'σ 알려짐 (z 검정)']} />
          {s.method === 't' && <p className="field-hint">E01에서 t를 골랐더라도 신뢰띠는 σ를 아는 z 검정으로 그립니다. t의 띠는 표본마다 S가 달라 하나의 그림으로 그릴 수 없습니다.</p>}
        </aside>

        <section className="col-chart panel chart-panel" aria-label="신뢰띠 그림">
          <StageSteps stage={stage} onStage={goStage} labels={STAGES.map((st) => st.title)} />

          {stage >= 4 && (
            <div className="run-bar" role="group" aria-label="참값에서 표본 뽑기">
              <button type="button" className="btn-filled sm" onClick={() => draw(1)} disabled={s.hide}>
                1회
              </button>
              <button type="button" className="btn-outline sm" onClick={() => draw(10)} disabled={s.hide}>
                10회
              </button>
              <button type="button" className="btn-outline sm" onClick={() => draw(100)} disabled={s.hide}>
                100회
              </button>
              <button type="button" className="btn-outline sm" onClick={() => draw(1000)} disabled={s.hide}>
                1,000회
              </button>
              {reps.running && (
                <button type="button" className="btn-filled sm danger" onClick={() => update({ k: reps.cancel() })}>
                  정지
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={() => update({ k: 0, sel: -1 })} disabled={count === 0}>
                초기화
              </button>
            </div>
          )}

          {stage >= 4 && s.hide ? (
            <p className="hidden-note">4단계는 참값 μ*의 세로선 위에서 표본을 뽑습니다. 참값을 숨긴 상태에서는 볼 수 없습니다. E01의 ‘참값 공개’ 또는 강의 모드의 H 키로 공개하세요.</p>
          ) : (
            <BeltChart
              svgRef={svgRef}
              domain={domain}
              se={se}
              level={s.level}
              alt={s.alt}
              stage={stage}
              mu0={mu0}
              xbarObs={xbar}
              truth={s.mu}
              points={points}
              selected={s.sel}
              onSelect={(b) => update({ sel: b === s.sel ? -1 : b })}
              ariaLabel={`신뢰띠 ${stage}단계. μ₀ = ${fmtNum(mu0, 3)}의 채택역 [${fmtBound(acc.lower)}, ${fmtBound(acc.upper)}]${stage >= 3 ? `, x̄ = ${fmtNum(xbar, 3)}의 신뢰구간 [${fmtBound(ci.lower)}, ${fmtBound(ci.upper)}]` : ''}`}
            />
          )}
          <Legend
            items={[
              { color: 'var(--c-mu0)', label: stage >= 4 ? '채택역 A(μ*) (참값의 세로 단면)' : '채택역 A(μ₀) (세로 단면)', pattern: 'fill' },
              ...(stage >= 2 ? [{ color: 'var(--c-accept)', label: '신뢰띠 (모든 μ₀의 채택역)' }] : []),
              ...(stage === 3 ? [{ color: 'var(--c-obs)', label: '신뢰구간 C(x̄) (가로 단면)', pattern: 'fill' as const }] : []),
              ...(stage >= 4 ? [{ color: 'var(--c-cover)', label: '띠 안의 x̄ (구간이 μ*를 포함)', pattern: 'fill' as const }, { color: 'var(--c-miss)', label: '띠 밖의 x̄ ✕', pattern: 'fill' as const }] : []),
            ]}
          />

          {stage === 3 && (
            <div className="duality" role="status" aria-live="polite">
              {inBand ? (
                <>
                  <span>
                    x̄ = {fmtNum(xbar, 3)} ∈ A({fmtNum(mu0, 3)})
                  </span>
                  <span className="eq">⟺</span>
                  <span className="verdict keep">H₀: μ = {fmtNum(mu0, 3)} 기각하지 않음</span>
                  <span className="eq">⟺</span>
                  <span>
                    {fmtNum(mu0, 3)} ∈ C(x̄)
                  </span>
                </>
              ) : (
                <>
                  <span>
                    x̄ = {fmtNum(xbar, 3)} ∉ A({fmtNum(mu0, 3)})
                  </span>
                  <span className="eq">⟺</span>
                  <span className="verdict reject">H₀: μ = {fmtNum(mu0, 3)} 기각</span>
                  <span className="eq">⟺</span>
                  <span>
                    {fmtNum(mu0, 3)} ∉ C(x̄)
                  </span>
                </>
              )}
              <span className="eq">(p = {test.p.toFixed(4)})</span>
            </div>
          )}

          {stage >= 4 && !s.hide ? (
            <StatGrid
              stats={[
                { tag: '띠 안에 떨어진 x̄', label: `${fmtInt(stats.covered)} / ${fmtInt(count)}`, value: pct(count ? stats.covered / count : NaN), sub: `명목수준 ${pct(s.level)}` },
                { tag: 'MC 표준오차', label: '√(ĉ(1−ĉ)/B)', value: count ? `${(err * 100).toFixed(2)}%p` : '—' },
                { tag: '= 구간이 μ*를 포함한 비율', label: 'E01(z)과 같은 표본', value: pct(count ? stats.covered / count : NaN), tone: 'orange' },
              ]}
            />
          ) : (
            <StatGrid
              stats={[
                { tag: '채택역 A(μ₀)', label: `μ₀ = ${fmtNum(mu0, 3)}`, value: `[${fmtBound(acc.lower)}, ${fmtBound(acc.upper)}]` },
                { tag: '신뢰구간 C(x̄)', label: stage >= 3 ? `x̄ = ${fmtNum(xbar, 3)}` : '3단계에서 공개', value: stage >= 3 ? `[${fmtBound(ci.lower)}, ${fmtBound(ci.upper)}]` : '—', tone: 'orange' },
                { tag: '띠의 세로 폭', label: s.alt === 'two' ? '2·q·SE' : '한쪽만 유한', value: s.alt === 'two' ? fmtNum(2 * q * se, 4) : '∞' },
              ]}
            />
          )}

          <h3 className="chart-title">7장의 그림: H₀: μ = μ₀에서 X̄의 표본분포와 기각역</h3>
          <DensityChart mu0={mu0} se={se} level={s.level} alt={s.alt} domain={domain} observed={stage >= 3 ? xbar : undefined} ariaLabel={`귀무분포 N(${fmtNum(mu0, 3)}, ${fmtNum(se, 3)}²)과 기각역`} height={180} />
          <p className="chart-caption">아래 굵은 선이 채택역, 빗금이 기각역입니다. 이 굵은 선을 세워서 μ₀ 위치에 꽂은 것이 위 그림의 세로 단면입니다.</p>

          <ExportBar s={s} update={update} experimentId="E02" svgRef={svgRef} csv={stage >= 4 ? () => replicatesCsv({ ...s, method: 'z' }, reps, count, 'E02') : undefined} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> 단계 · <kbd>Space</kbd> 4단계에서 1회 · <kbd>H</kbd> 참값 숨김/공개
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.1 식 (8.5)–(8.7) · 8.7 정리 8.10·8.11 · p.302–303, 322–324</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>{['검정 하나에서 출발', '채택역을 모두 쌓는다', '띠를 가로로 자르면 구간', '포함 ⟺ 채택역에 떨어짐'][stage - 1]}</h2>
          <ExplainTabs
            intuition={
              [
                <p key={1}>7장에서 H₀: μ = μ₀를 검정할 때, 기각하지 않는 x̄의 범위가 채택역 A(μ₀)입니다. 그림의 세로 막대가 그것입니다. μ₀ 슬라이더를 움직여 보세요.</p>,
                <p key={2}>μ₀마다 검정이 하나씩 있고, 채택역도 하나씩 있습니다. 그것을 모두 세워 놓으면 띠가 됩니다. 이 띠는 ‘모수값마다 하나씩 있는 검정’을 모은 것입니다.</p>,
                <p key={3}>자료를 관측하면 x̄이 정해집니다. 그 높이에서 띠를 가로로 자르면, 띠 안에 있는 μ₀들, 곧 이 자료로 기각되지 않는 μ₀들의 집합이 나옵니다. 그것이 신뢰구간입니다.</p>,
                <p key={4}>참값 μ*에서 뽑은 표본의 x̄은 모두 μ* 세로선 위에 떨어집니다. x̄이 띠 안(채택역 A(μ*) 안)에 떨어지면 그 표본의 구간은 μ*를 포함합니다. 그래서 포함률 = P(X̄ ∈ A(μ*)) = 1 − α입니다. 움직이는 것은 x̄이고, μ*는 움직이지 않습니다.</p>,
              ][stage - 1]
            }
            calc={
              <>
                <Tex block>{String.raw`q = ${s.alt === 'two' ? 'Q_{1-\\alpha/2}' : 'Q_{1-\\alpha}'} = ${q.toFixed(6)},\quad \mathrm{SE} = ${fmtNum(se, 4)}`}</Tex>
                <Tex block>{String.raw`A(${fmtNum(mu0, 3)}) = [${fmtBound(acc.lower)},\ ${fmtBound(acc.upper)}]`}</Tex>
                {stage >= 3 && <Tex block>{String.raw`C(${fmtNum(xbar, 3)}) = [${fmtBound(ci.lower)},\ ${fmtBound(ci.upper)}]`}</Tex>}
              </>
            }
            proof={
              <>
                <p>각 μ₀에서 수준 α 검정의 채택역을 A(μ₀)라 하면, 관측값 x에 대해</p>
                <Tex block>{String.raw`C(x) = \{\mu_0 : x \in A(\mu_0)\}`}</Tex>
                <p>로 정의한 집합은 다음을 만족합니다.</p>
                <Tex block>{String.raw`P_\mu\{\mu \in C(X)\} = P_\mu\{X \in A(\mu)\} = 1-\alpha`}</Tex>
                <p>가운데 등호는 두 사건이 같은 사건이기 때문이고, 마지막 등호는 검정의 크기가 α이기 때문입니다(교재 정리 8.10). 거꾸로, 신뢰구간에서 채택역을 만들 수도 있습니다(정리 8.11).</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
