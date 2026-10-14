// E02 이항 신뢰띠 — 정확검정(CP)·score·Wald 검정을 뒤집은 계단형 띠 (PRD v2 §7 E02, E06 미리보기)
import { useMemo, useRef } from 'react'
import { randomSeed } from '../engine/core/rng'
import { BINOM_METHODS, binomAcceptance, binomBelt, binomCoverage, binomTestP, type BinomMethod } from '../engine/binomial'
import { contains } from '../engine/meanInterval'
import { mcSe } from '../engine/repeat'
import { BinomBeltChart } from '../components/chart/BinomBeltChart'
import { CoverageCurve } from '../components/chart/CoverageCurve'
import { PmfChart } from '../components/chart/PmfChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { binomCsv } from '../lib/exports'
import { fmtInt, fmtNum, formatSet } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useBinomReplicates } from '../lib/useBinomReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'
import { StageSteps } from './StageSteps'

const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const f4 = (v: number) => fmtNum(v, 4)
const COMPARE_COLORS: Record<BinomMethod, string> = { cp: 'var(--c-accept)', wilson: '#176b30', wald: 'var(--c-miss)' }

export function E02Binom({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const { bn: n, level, bmethod: method, stage } = s
  const x = Math.min(s.bx, n)
  const belt = useMemo(() => binomBelt(n, level, method), [n, level, method])
  const others = useMemo(() => (s.cmp ? BINOM_METHODS.filter((m) => m.id !== method).map((m) => ({ belt: binomBelt(n, level, m.id), color: COMPARE_COLORS[m.id], label: m.label })) : []), [s.cmp, n, level, method])
  const slice = stage >= 4 ? s.ps : s.p0
  const accept = binomAcceptance(n, slice, level, method)
  const ci = belt[x]
  const pval = binomTestP(x, n, s.p0, method)
  const notRejected = pval >= 1 - level
  const exactAtSlice = binomCoverage(n, slice, belt)
  const cpCoverage = useMemo(() => binomCoverage(n, s.ps, binomBelt(n, level, 'cp')), [n, s.ps, level])

  const reps = useBinomReplicates(s.seed, n, s.ps, stage >= 4 && !s.hide ? s.k : 0)
  const freq = useMemo(() => {
    const f = new Array<number>(n + 1).fill(0)
    for (let b = 0; b < reps.count; b++) f[reps.xs[b]]++
    return f
  }, [reps.xs, reps.count, n])
  const covered = freq.reduce((a, v, k) => a + (contains(belt[k], s.ps) ? v : 0), 0)
  const err = mcSe(covered, reps.count)

  const draw = (m: number) => update((cur) => ({ k: Math.min(LIMITS.k[1], cur.k + m), seed: cur.seed < 0 ? randomSeed() : cur.seed }))
  const stepStage = (d: number) => update((cur) => ({ stage: Math.min(4, Math.max(1, cur.stage + d)) }))
  useShortcuts({ ArrowRight: () => stepStage(1), ArrowLeft: () => stepStage(-1), Space: () => stage >= 4 && draw(1), h: () => update((cur) => ({ hide: !cur.hide })) }, present)

  const meta = BINOM_METHODS.find((m) => m.id === method)!
  const compareOn = s.cmp

  return (
    <>
      <Predict
        experimentId="E02"
        itemId="E02-P2-binom"
        question={`정확검정을 뒤집은 Clopper–Pearson ${Math.round(level * 1000) / 10}% 구간(n = ${n})의 실제 포함률은 어떨까요?`}
        choices={[
          { text: `어떤 p*에서든 정확히 ${Math.round(level * 1000) / 10}%`, misconception: 'M6', feedback: 'x가 정수뿐이라 채택역의 질량을 정확히 1 − α로 맞출 수 없습니다. 그래서 포함률은 p*마다 달라집니다.' },
          { text: `언제나 ${Math.round(level * 1000) / 10}% 이상이고, p*에 따라 달라진다`, correct: true, feedback: '정확검정은 크기가 α를 넘지 않도록 만들어집니다. 그래서 그것을 뒤집은 CP 구간의 포함률은 모든 p*에서 1 − α 이상(보수적)이고, 이산성 때문에 p*마다 다릅니다.' },
          { text: `대체로 ${Math.round(level * 1000) / 10}%보다 낮다`, misconception: 'M6', feedback: '그것은 교재의 Wald 구간에서 흔히 일어나는 일입니다. ‘다른 검정의 띠 겹쳐 보기’로 비교해 보세요.' },
          { text: '참값을 모르므로 계산할 수 없다', misconception: 'M1', feedback: '실제 연구에서는 p*를 모르지만, 포함률 c(p) 자체는 모든 p에서 전수 합으로 계산할 수 있습니다.' },
        ]}
        revealed={stage >= 4 && !s.hide}
        waitHint="‘4단계 반복표집’에서 정확 포함률을 확인하세요."
        resultSummary={`n = ${n}, p* = ${s.ps}에서 CP의 정확 포함률은 ${pct(cpCoverage, 2)}입니다.`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>설정</h2>
          <div className="field">
            <span className="field-label">프리셋</span>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn-outline sm" title="n = 10, x = 3, 95%, CP" onClick={() => update({ bn: 10, bx: 3, p0: 0.3, ps: 0.3, level: 0.95, bmethod: 'cp' })}>
                기준 사례 (n=10, x=3)
              </button>
              <button type="button" className="btn-outline sm" title="n = 30" onClick={() => update({ bn: 30, bx: 9, p0: 0.3, ps: 0.3 })}>
                n = 30
              </button>
            </div>
          </div>
          <SliderField label="시행 수 n" value={n} min={LIMITS.bn[0]} max={LIMITS.bn[1]} step={1} onChange={(bn) => update((cur) => ({ bn, bx: Math.min(cur.bx, bn) }))} />
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <Segmented<BinomMethod> label="뒤집는 검정" value={method} options={BINOM_METHODS.map((m) => ({ value: m.id, label: m.id === 'cp' ? '정확 (CP)' : m.id === 'wilson' ? 'score' : 'Wald' }))} onChange={(bmethod) => update({ bmethod })} />
          <p className="field-hint">
            {meta.label}: {meta.test}
            {meta.scope === '교재' ? ' · 교재 8.6.1의 방법' : ' · 교재 밖 확장'}
          </p>
          <label className="row" style={{ gap: 8, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={compareOn} onChange={(e) => update({ cmp: e.target.checked })} disabled={stage < 2} />
            다른 검정의 띠 겹쳐 보기
          </label>
          <SliderField label="가설값 p₀ (세로 단면)" value={s.p0} min={0} max={1} step={0.001} onChange={(p0) => update({ p0 })} format={(v) => v.toFixed(3)} disabled={stage >= 4} disabledReason="4단계에서는 참값 p*의 세로 단면을 봅니다." />
          <SliderField label="관측 x (가로 단면)" value={x} min={0} max={n} step={1} onChange={(bx) => update({ bx })} disabled={stage !== 3} disabledReason={stage < 3 ? '3단계에서 움직일 수 있습니다.' : '4단계에서는 반복표집한 x들을 봅니다.'} />
          <SliderField label="참값 p* (교육용)" value={s.ps} min={0} max={1} step={0.001} onChange={(ps) => update({ ps })} format={(v) => v.toFixed(3)} disabled={stage < 4} disabledReason="4단계에서 움직일 수 있습니다." />
          <AssumptionBadges items={['독립 베르누이 시행', 'n 고정', '양측']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="이항 신뢰띠 그림">
          <StageSteps stage={stage} onStage={(n2) => update({ stage: n2 })} labels={['검정 하나', '띠 쌓기', '가로로 자르기', '반복표집']} />

          {stage >= 4 && (
            <div className="run-bar" role="group" aria-label="참값에서 표본 뽑기">
              {[1, 10, 100, 1000].map((m) => (
                <button key={m} type="button" className={m === 1 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => draw(m)} disabled={s.hide}>
                  {m.toLocaleString('ko-KR')}회
                </button>
              ))}
              <button type="button" className="btn-ghost" onClick={() => update({ k: 0 })} disabled={reps.count === 0}>
                초기화
              </button>
            </div>
          )}

          {stage >= 4 && s.hide ? (
            <p className="hidden-note">4단계는 참값 p*의 세로선 위에서 표본을 뽑습니다. 참값을 숨긴 상태에서는 볼 수 없습니다.</p>
          ) : (
            <BinomBeltChart
              svgRef={svgRef}
              n={n}
              belt={belt}
              compare={others}
              stage={stage}
              slice={slice}
              accept={accept}
              xObs={x}
              freq={stage >= 4 ? freq : undefined}
              ariaLabel={`이항 신뢰띠 ${stage}단계 (${meta.label}). ${stage >= 4 ? `p* = ${s.ps}` : `p₀ = ${s.p0}`}의 채택역 x ∈ ${formatSet(accept)}${stage === 3 ? `, x = ${x}의 신뢰구간 [${f4(ci.lower)}, ${f4(ci.upper)}]` : ''}`}
            />
          )}
          <Legend
            items={[
              { color: 'var(--c-mu0)', label: stage >= 4 ? '채택역 A(p*) (채운 점)' : '채택역 A(p₀) (채운 점)', pattern: 'fill' },
              { color: 'var(--c-reject)', label: '기각되는 x (빈 점)' },
              ...(stage >= 2 ? [{ color: 'var(--c-accept)', label: 'x마다의 구간 = 계단형 신뢰띠' }] : []),
              ...(compareOn && stage >= 2 ? others.map((o) => ({ color: o.color, label: `${o.label} (점선)`, pattern: 'line' as const })) : []),
              ...(stage === 3 ? [{ color: 'var(--c-obs)', label: '신뢰구간 C(x) (가로 단면)', pattern: 'fill' as const }] : []),
              ...(stage >= 4 ? [{ color: 'var(--c-cover)', label: '구간이 p*를 포함한 x의 도수' }, { color: 'var(--c-miss)', label: '포함하지 못한 x의 도수 ✕', pattern: 'fill' as const }] : []),
            ]}
          />

          {stage === 3 && (
            <div className="duality" role="status" aria-live="polite">
              <span>
                x = {x} {notRejected ? '∈' : '∉'} A({s.p0.toFixed(3)})
              </span>
              <span className="eq">⟺</span>
              <span className={`verdict ${notRejected ? 'keep' : 'reject'}`}>
                H₀: p = {s.p0.toFixed(3)} {notRejected ? '기각하지 않음' : '기각'}
              </span>
              <span className="eq">⟺</span>
              <span>
                {s.p0.toFixed(3)} {notRejected ? '∈' : '∉'} C({x})
              </span>
              <span className="eq">(p = {pval.toFixed(4)})</span>
            </div>
          )}

          {stage >= 4 && !s.hide ? (
            <StatGrid
              stats={[
                { tag: '구간이 p*를 포함', label: `${fmtInt(covered)} / ${fmtInt(reps.count)}`, value: pct(reps.count ? covered / reps.count : NaN), sub: reps.count ? `MC SE ${(err * 100).toFixed(2)}%p` : '표본을 뽑아 보세요' },
                { tag: '정확 포함률 c(p*)', label: '= A(p*)의 확률 질량', value: pct(exactAtSlice, 2), sub: `명목수준 ${pct(level)}` },
                { tag: '정확검정의 실제 크기', label: '= 1 − c(p*)', value: pct(1 - exactAtSlice, 2), tone: 'orange', sub: `α = ${pct(1 - level)}` },
              ]}
            />
          ) : (
            <StatGrid
              stats={[
                { tag: '채택역 A(p₀)', label: `p₀ = ${s.p0.toFixed(3)}`, value: `x ∈ ${formatSet(accept)}` },
                { tag: '신뢰구간 C(x)', label: stage >= 3 ? `x = ${x}` : '3단계에서 공개', value: stage >= 3 ? `[${f4(ci.lower)}, ${f4(ci.upper)}]` : '—', tone: 'orange' },
                { tag: 'A(p₀)의 확률 질량', label: '= p₀에서의 포함률', value: pct(exactAtSlice, 2), sub: `명목 ${pct(level)}` },
              ]}
            />
          )}

          {stage >= 4 && !s.hide ? (
            <>
              <h3 className="chart-title">포함률 함수 c(p): 계단 띠라서 톱니 모양 (E06 미리보기)</h3>
              <CoverageCurve n={n} level={level} belt={belt} mark={s.ps} ariaLabel={`${meta.label} 구간의 정확 포함률 함수, p* = ${s.ps}에서 ${pct(exactAtSlice, 2)}`} />
            </>
          ) : (
            <>
              <h3 className="chart-title">7장의 그림: H₀: p = p₀에서 X ~ Binomial(n, p₀)</h3>
              <PmfChart n={n} p0={s.p0} accept={accept} observed={stage >= 3 ? x : undefined} ariaLabel={`귀무분포 Binomial(${n}, ${s.p0})과 채택역 ${formatSet(accept)}`} />
              <p className="chart-caption">채운 막대가 채택역, 빗금 막대가 기각역입니다. 이 막대들을 점으로 세워 p₀ 위치에 꽂은 것이 위 그림의 세로 단면입니다.</p>
            </>
          )}

          <ExportBar s={s} update={update} experimentId="E02" svgRef={svgRef} csv={stage >= 4 ? () => binomCsv(s, reps.xs, reps.count) : undefined} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> 단계 · <kbd>Space</kbd> 4단계에서 1회 · <kbd>H</kbd> 참값 숨김/공개
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.6.1 · 8.7 정리 8.10 · p.319–324</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>{['정확검정 하나에서 출발', '채택역을 쌓으면 계단 띠', '띠를 가로로 자르면 구간', '포함률 = 채택역의 확률 질량'][stage - 1]}</h2>
          <ExplainTabs
            intuition={
              [
                <p key={1}>H₀: p = p₀에서 X ~ Binomial(n, p₀)입니다. 양 꼬리에서 확률이 각각 α/2보다 작은 x들을 기각하면, 남는 x들이 채택역 A(p₀)입니다. 세로선 위의 채운 점이 그것입니다.</p>,
                <p key={2}>p₀마다 채택역을 구해 쌓으면, x마다 ‘그 x를 받아들이는 p₀들의 범위’가 가로 막대로 나타납니다. x가 정수뿐이라 띠는 매끈한 띠가 아니라 계단 모양입니다.</p>,
                <p key={3}>x를 관측하면 그 높이의 막대 하나가 곧 신뢰구간입니다. 정확검정을 뒤집으면 Clopper–Pearson 구간, score 검정을 뒤집으면 Wilson 구간, Wald 검정을 뒤집으면 교재 8.6.1의 구간이 됩니다. 어떤 검정을 뒤집느냐가 어떤 구간이 나오느냐를 정합니다.</p>,
                <p key={4}>참값 p*에서 뽑은 x가 채택역 A(p*) 안에 떨어지면 그 x의 구간은 p*를 포함합니다. 그래서 포함률 c(p*)는 A(p*)의 확률 질량이고, 1 − c(p*)는 정확검정의 실제 크기입니다. 이산분포에서는 이 값이 정확히 1 − α가 되지 않습니다.</p>,
              ][stage - 1]
            }
            calc={
              <>
                <Tex block>{String.raw`A(${s.p0.toFixed(3)}) = ${formatSet(binomAcceptance(n, s.p0, level, method)).replace(/…/g, '\\dots')}`}</Tex>
                <Tex block>{String.raw`C(${x}) = [${f4(ci.lower)},\ ${f4(ci.upper)}]`}</Tex>
                {method === 'cp' && (
                  <>
                    <Tex block>{String.raw`L = Q_{\alpha/2}\{\mathrm{Beta}(x,\,n-x+1)\},\quad U = Q_{1-\alpha/2}\{\mathrm{Beta}(x+1,\,n-x)\}`}</Tex>
                    <p className="muted">x = 0이면 L = 0, x = n이면 U = 1입니다.</p>
                  </>
                )}
                {method === 'wald' && <p className="muted">x = 0 또는 x = n이면 표준오차가 0이 되어 구간이 한 점 [p̂, p̂]로 퇴화합니다. [0, 1] 밖으로 나간 끝점은 잘라내지 않고 그대로 보여 줍니다.</p>}
              </>
            }
            proof={
              <>
                <p>정확검정의 채택역을 A(p₀) = {'{'}x : P_p₀(X ≤ x) ≥ α/2 이고 P_p₀(X ≥ x) ≥ α/2{'}'}라 하면</p>
                <Tex block>{String.raw`C(x) = \{p_0 : x \in A(p_0)\}`}</Tex>
                <p>P_p(X ≥ x)는 p에 대해 증가하고 P_p(X ≤ x)는 감소하므로, 이 집합은 구간 [L, U]이며 끝점은 위의 베타 분위수입니다.</p>
                <Tex block>{String.raw`c(p) = P_p\{p \in C(X)\} = P_p\{X \in A(p)\} \ge 1-\alpha`}</Tex>
                <p>마지막 부등호는 정확검정의 크기가 α 이하이기 때문입니다. 등호가 성립하지 않는 것이 이산분포의 특징입니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
