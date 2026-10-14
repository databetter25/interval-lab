// E06 이항구간 비교 — 같은 관측, 다른 구간, 정확 성능 (PRD v2 §7 E06)
import { useMemo, useRef, useState } from 'react'
import { randomSeed } from '../engine/core/rng'
import { COMPARE_METHODS, compareBelt, performanceAt, type CompareMethod } from '../engine/binomCompare'
import { mcSe } from '../engine/repeat'
import { MetricCurveChart, METRIC_LABEL, type CurveSeries, type Metric } from '../components/chart/MetricCurveChart'
import { PmfChart } from '../components/chart/PmfChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Fold, Segmented, SliderField, Tex, TextbookBadge } from '../components/ui'
import { compareCsv, curvesCsv } from '../lib/exports'
import { fmtInt, fmtNum, formatSet } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useBinomReplicates } from '../lib/useBinomReplicates'
import { usePerfCurves } from '../lib/usePerfCurves'
import { LIMITS, type LabState, type Update } from '../state/labState'

const pct = (v: number, d = 2) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const f4 = (v: number) => fmtNum(v, 4)
const META = Object.fromEntries(COMPARE_METHODS.map((m) => [m.id, m])) as Record<CompareMethod, (typeof COMPARE_METHODS)[number]>

const PRESETS: { label: string; title: string; patch: Partial<LabState> }[] = [
  { label: '기준 사례', title: 'n = 10, x = 3, p* = 0.3', patch: { en: 10, bx: 3, ps: 0.3, level: 0.95 } },
  { label: '경계 사례', title: 'n = 10, p* = 0.01 — 사후질량 95%인데 포함률 90.4%', patch: { en: 10, bx: 0, ps: 0.01, level: 0.95, cm: ['wald', 'wilson', 'cp', 'jeffreys', 'jeffreys_boundary'] } },
  { label: 'n = 50', title: 'n = 50, x = 6, p* = 0.12', patch: { en: 50, bx: 6, ps: 0.12 } },
  { label: 'n = 1000', title: '큰 표본: 방법 차이가 줄어든다', patch: { en: 1000, bx: 30, ps: 0.03 } },
]

export function E06({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawn, setDrawn] = useState(false)
  const n = s.en
  const x = Math.min(s.bx, n)
  const prior = useMemo(() => ({ a: s.pa, b: s.pb }), [s.pa, s.pb])
  const ids = s.cm
  const [focusRaw, setFocus] = useState<CompareMethod>('jeffreys')
  const focus = ids.includes(focusRaw) ? focusRaw : ids[0]
  const metric = s.metric as Metric

  const belts = useMemo(() => Object.fromEntries(ids.map((m) => [m, compareBelt(n, s.level, m, prior)])) as Record<CompareMethod, ReturnType<typeof compareBelt>>, [ids, n, s.level, prior])
  const { curves, computing } = usePerfCurves(n, s.level, ids, prior)
  const atP = ids.map((m) => ({ id: m, ...performanceAt(belts[m], s.ps) }))

  const reps = useBinomReplicates(s.seed, n, s.ps, s.k)
  const mc = useMemo(() => {
    const out: Record<string, number> = {}
    for (const m of ids) {
      const belt = belts[m]
      let k = 0
      for (let b = 0; b < reps.count; b++) {
        const iv = belt[reps.xs[b]]
        if (iv.lower <= s.ps && s.ps <= iv.upper) k++
      }
      out[m] = k
    }
    return out
  }, [ids, belts, reps.xs, reps.count, s.ps])

  const draw = (m: number) => update((cur) => ({ k: Math.min(LIMITS.k[1], cur.k + m), seed: cur.seed < 0 ? randomSeed() : cur.seed }))
  useShortcuts({ Space: () => draw(100), ArrowRight: () => update((c) => ({ ps: Math.min(0.999, Number((c.ps + 0.01).toFixed(3))) })), ArrowLeft: () => update((c) => ({ ps: Math.max(0.001, Number((c.ps - 0.01).toFixed(3))) })) }, present)

  const toggle = (m: CompareMethod) => {
    const next = ids.includes(m) ? ids.filter((v) => v !== m) : [...ids, m]
    if (next.length) update({ cm: COMPARE_METHODS.map((c) => c.id).filter((id) => next.includes(id)) })
  }

  const series: CurveSeries[] =
    curves && ids.every((m) => curves[m])
      ? ids.map((m) => ({
          id: m,
          label: META[m].label,
          color: META[m].color,
          dash: META[m].dash,
          curves: curves[m],
          mc: metric === 'coverage' && reps.count ? { value: mc[m] / reps.count, se: mcSe(mc[m], reps.count) } : undefined,
        }))
      : []

  const focusBelt = belts[focus]
  const included = focusBelt.map((iv) => iv.lower <= s.ps && s.ps <= iv.upper)
  const onlyZero = included[0] && included.slice(1).every((v) => !v)
  const focusPerf = atP.find((r) => r.id === focus)!
  const wald = atP.find((r) => r.id === 'wald')

  return (
    <>
      <Predict
        experimentId="E06"
        itemId="E06-P1"
        question={`n = ${n}에서 교재의 Wald 95% 구간은 실제로 95%를 지킬까요? (가장 짧은 축에 드는 구간입니다)`}
        choices={[
          { text: '대체로 95% 근처를 지킨다', misconception: 'M6', feedback: 'n이 작으면 Wald 구간은 많은 p에서 95%보다 한참 낮습니다. 특히 p가 0이나 1에 가까울수록 크게 무너집니다.' },
          { text: '많은 p에서 95%보다 꽤 낮고, p에 따라 톱니처럼 흔들린다', correct: true, feedback: '근사 검정(Wald)을 뒤집은 구간은 크기를 보장하지 않습니다. 이산성 때문에 포함률은 p에 따라 톱니처럼 흔들리고, 작은 n에서는 명목수준을 자주 밑돕니다.' },
          { text: '언제나 95% 이상이다', misconception: 'M6', feedback: '그것은 정확검정을 뒤집은 Clopper–Pearson 구간의 성질입니다. Wald는 그렇지 않습니다.' },
          { text: '짧으니까 가장 좋은 구간이다', misconception: 'M5', feedback: '길이는 포함률을 먼저 확인한 뒤에 비교해야 합니다. 포함률을 지키지 못하는 짧은 구간은 좋은 구간이 아닙니다.' },
        ]}
        revealed={drawn}
        waitHint="‘포함률 곡선 그리기’를 눌러 확인하세요."
        resultSummary={curves?.wald ? `n = ${n}에서 Wald의 격자 평균 포함률은 ${pct(curves.wald.gridMeanCoverage, 1)}, 격자 최솟값은 ${pct(curves.wald.gridMinCoverage, 1)}입니다.` : wald ? `p* = ${s.ps}에서 Wald의 포함률은 ${pct(wald.coverage)}입니다.` : ''}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>설정</h2>
          <div className="field">
            <span className="field-label">프리셋</span>
            <div className="row" style={{ gap: 6 }}>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn-outline sm" title={p.title} onClick={() => update(p.patch)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <SliderField label="시행 수 n" value={n} min={LIMITS.en[0]} max={LIMITS.en[1]} step={1} onChange={(en) => update((c) => ({ en, bx: Math.min(c.bx, en) }))} hint={n > 150 ? '큰 n은 백그라운드(Worker)에서 계산합니다.' : undefined} />
          <SliderField label="관측 x (구간 비교용)" value={x} min={0} max={n} step={1} onChange={(bx) => update({ bx })} />
          <SliderField label="신뢰수준 1−α" value={s.level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(level) => update({ level })} format={(v) => pct(v, 1)} />
          <SliderField label="참값 p* (교육용)" value={s.ps} min={0.001} max={0.999} step={0.001} onChange={(ps) => update({ ps })} format={(v) => v.toFixed(3)} />
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label">비교할 방법</legend>
            {COMPARE_METHODS.map((m) => (
              <label key={m.id} className="row" style={{ gap: 8, fontSize: '0.84rem', flexWrap: 'nowrap' }} title={m.basis}>
                <input type="checkbox" checked={ids.includes(m.id)} onChange={() => toggle(m.id)} />
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="0" x2="22" y1="4" y2="4" stroke={m.color} strokeWidth="2" strokeDasharray={m.dash} />
                </svg>
                <span>
                  {m.label}
                  {m.variant ? '' : m.scope === '교재' ? ' · 교재' : ''}
                </span>
              </label>
            ))}
          </fieldset>
          {ids.includes('bayes_beta') && (
            <>
              <SliderField label="사전 Beta a" value={s.pa} min={0.1} max={20} step={0.1} onChange={(pa) => update({ pa })} />
              <SliderField label="사전 Beta b" value={s.pb} min={0.1} max={20} step={0.1} onChange={(pb) => update({ pb })} />
            </>
          )}
          <AssumptionBadges items={['독립 베르누이 시행', 'n 고정', '양측']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="이항구간 비교">
          <h3 className="chart-title" style={{ marginTop: 0 }}>
            같은 관측 x = {x} (n = {n}), 다른 구간
          </h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="가로로 스크롤되는 표">
            <table className="data-table compare-table">
              <caption className="sr-only">방법별 {Math.round(s.level * 1000) / 10}% 구간</caption>
              <thead>
                <tr>
                  <th scope="col">방법</th>
                  <th scope="col">구간</th>
                  <th scope="col">길이</th>
                  <th scope="col">근거</th>
                </tr>
              </thead>
              <tbody>
                {ids.map((m) => {
                  const iv = belts[m][x]
                  const out = iv.lower < 0 || iv.upper > 1
                  return (
                    <tr key={m}>
                      <th scope="row">
                        <span className="method-swatch" style={{ borderTopColor: META[m].color, borderTopStyle: META[m].dash ? 'dashed' : 'solid' }} aria-hidden="true" />
                        {META[m].label}
                      </th>
                      <td className="num">
                        [{f4(iv.lower)}, {f4(iv.upper)}]{out && <span className="badge badge-orange" style={{ marginLeft: 6 }}>[0, 1] 밖</span>}
                        {iv.upper - iv.lower === 0 && <span className="badge badge-orange" style={{ marginLeft: 6 }}>퇴화</span>}
                      </td>
                      <td className="num">{f4(iv.upper - iv.lower)}</td>
                      <td className="muted small">{META[m].basis}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
            <h3 className="chart-title" style={{ margin: 0 }}>
              정확 성능 곡선 (전수 합)
            </h3>
            <Segmented<Metric>
              label="지표"
              value={metric}
              options={[
                { value: 'coverage', label: '포함률' },
                { value: 'meanLength', label: '평균 길이' },
                { value: 'missLeft', label: '좌측 비포함' },
                { value: 'missRight', label: '우측 비포함' },
              ]}
              onChange={(m) => update({ metric: m })}
            />
          </div>
          {!drawn ? (
            <div className="hidden-note" style={{ background: 'var(--c-blue-bg)' }}>
              위에서 예상을 정한 뒤 곡선을 그려 보세요.{' '}
              <button type="button" className="btn-filled sm" onClick={() => setDrawn(true)}>
                포함률 곡선 그리기
              </button>
            </div>
          ) : series.length ? (
            <>
              <MetricCurveChart
                svgRef={svgRef}
                series={series}
                metric={metric}
                level={s.level}
                mark={s.ps}
                onPick={(ps) => update({ ps })}
                ariaLabel={`${METRIC_LABEL[metric]} 곡선, n = ${n}. ${atP.map((r) => `${META[r.id].label} ${pct(r[metric === 'coverage' ? 'coverage' : metric])}`).join(', ')} (p* = ${s.ps})`}
              />
              <div className="chart-legend">
                {series.map((sr) => (
                  <span key={sr.id}>
                    <span className="legend-swatch" style={{ background: 'transparent', borderTop: `2px ${sr.dash ? 'dashed' : 'solid'} ${sr.color}`, height: 0, marginBottom: 3 }} />
                    {sr.label}
                  </span>
                ))}
                {metric === 'coverage' && reps.count > 0 && <span>■ p*의 시뮬레이션 추정 (±2 MC SE)</span>}
              </div>
              {computing && <p className="chart-caption">새 설정으로 계산 중…</p>}
            </>
          ) : (
            <p className="chart-caption" role="status">
              곡선 계산 중… (n = {n}, 격자 999점)
            </p>
          )}

          <div className="run-bar" role="group" aria-label="p*에서 표본 뽑기" style={{ marginTop: 12 }}>
            <span className="kbd-help">p* = {s.ps}에서 시뮬레이션:</span>
            {[100, 1000, 10000].map((m) => (
              <button key={m} type="button" className="btn-outline sm" onClick={() => draw(m)}>
                {m.toLocaleString('ko-KR')}회
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => update({ k: 0 })} disabled={reps.count === 0}>
              초기화
            </button>
            {reps.count > 0 && <span className="kbd-help">반복 {fmtInt(reps.count)}회</span>}
          </div>

          <div className="table-scroll" tabIndex={0} role="region" aria-label="가로로 스크롤되는 표">
            <table className="data-table compare-table">
              <caption className="sr-only">p* = {s.ps}에서의 성능</caption>
              <thead>
                <tr>
                  <th scope="col">방법</th>
                  <th scope="col">c(p*)</th>
                  <th scope="col">MC 추정</th>
                  <th scope="col">평균 길이</th>
                  <th scope="col">좌측 P(L&gt;p)</th>
                  <th scope="col">우측 P(U&lt;p)</th>
                  <th scope="col">격자 최솟값</th>
                  <th scope="col">격자 평균</th>
                </tr>
              </thead>
              <tbody>
                {atP.map((r) => {
                  const c = curves?.[r.id]
                  const under = r.coverage < s.level
                  return (
                    <tr key={r.id}>
                      <th scope="row">{META[r.id].label}</th>
                      <td className={`num${under ? ' under' : ''}`}>
                        {pct(r.coverage)}
                        {under ? ' ▼' : ''}
                      </td>
                      <td className="num">{reps.count ? `${pct(mc[r.id] / reps.count)} ±${(2 * mcSe(mc[r.id], reps.count) * 100).toFixed(2)}` : '—'}</td>
                      <td className="num">{f4(r.meanLength)}</td>
                      <td className="num">{pct(r.missLeft)}</td>
                      <td className="num">{pct(r.missRight)}</td>
                      <td className="num">{c ? `${pct(c.gridMinCoverage, 1)} (p=${c.gridMinAt})` : '…'}</td>
                      <td className="num">{c ? pct(c.gridMeanCoverage, 1) : '…'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="chart-caption">▼ 명목수준 미만. 격자 = p = 0.001, 0.002, …, 0.999 (999점). 격자 최솟값은 격자 위의 최솟값이며 모든 p에 대한 하한을 뜻하지 않습니다.</p>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
            <h3 className="chart-title" style={{ margin: 0 }}>
              p* = {s.ps}에서 구간이 p*를 포함하는 x들
            </h3>
            <label className="row" style={{ gap: 6, fontSize: '0.84rem' }}>
              방법
              <select className="select" value={focus} onChange={(e) => setFocus(e.target.value as CompareMethod)}>
                {ids.map((m) => (
                  <option key={m} value={m}>
                    {META[m].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <PmfChart n={n} p0={s.ps} accept={included} ariaLabel={`Binomial(${n}, ${s.ps})에서 ${META[focus].label} 구간이 p*를 포함하는 x = ${formatSet(included)}`} />
          <p className="chart-caption">
            채운 막대 = {META[focus].label} 구간이 p*를 포함하는 x {formatSet(included)}. 이 막대들의 확률 합이 c(p*) = {pct(focusPerf.coverage)}이며, E02의 채택역 A(p*)와 같은 것입니다.
            {onlyZero && ` x = 0일 때만 참값을 포함하므로 c(p*) = P(X = 0) = (1 − ${s.ps})^${n} = ${(1 - s.ps) ** n >= 1e-4 ? ((1 - s.ps) ** n).toFixed(7) : ((1 - s.ps) ** n).toExponential(3)}입니다.`}
          </p>

          <ExportBar
            s={s}
            update={update}
            experimentId="E06"
            svgRef={svgRef}
            csv={reps.count ? () => compareCsv(s, reps.xs, reps.count) : undefined}
            extra={curves && ids.every((m) => curves[m]) ? [{ label: '곡선 CSV', filename: 'curves.csv', make: () => curvesCsv(s, curves) }] : []}
          />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> p* 이동 · <kbd>Space</kbd> 100회
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.6.1 (Wald) · 9.4 [예 9.7] · 확장: CP·Wilson·Jeffreys</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>짧은 구간보다 먼저 포함률</h2>
          <ExplainTabs
            intuition={
              <>
                <p>같은 x = {x}에도 방법마다 구간이 다릅니다. 어떤 검정을 뒤집었는지(Wald·score·정확검정), 또는 어떤 사후분포를 썼는지(Jeffreys·Beta 사전)가 다르기 때문입니다.</p>
                <p>방법을 비교할 때는 포함률 곡선 c(p)를 먼저 보고, 명목수준을 지키는 방법들 사이에서 길이를 비교합니다. x가 정수뿐이라 c(p)는 매끈하지 않고 톱니처럼 흔들립니다.</p>
                <p className="muted">c(p)는 시뮬레이션이 아니라 모든 x에 대한 전수 합입니다. 시뮬레이션 점은 이 정확값 주변에서 MC 오차만큼 흔들립니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`c(p) = \sum_{x=0}^{n} \mathbf 1\{L(x)\le p\le U(x)\}\binom{n}{x}p^x(1-p)^{n-x}`}</Tex>
                <Tex block>{String.raw`\text{평균 길이} = \sum_x \{U(x)-L(x)\}\,P_p(X=x)`}</Tex>
                <p>
                  {META[focus].label}, p* = {s.ps}: c = {pct(focusPerf.coverage)}, 평균 길이 {f4(focusPerf.meanLength)}, 좌측 {pct(focusPerf.missLeft)}, 우측 {pct(focusPerf.missRight)}
                </p>
              </>
            }
            proof={
              <>
                <p>
                  <strong>정확검정 → CP:</strong> 크기 ≤ α인 검정을 뒤집었으므로 모든 p에서 c(p) ≥ 1 − α입니다(보수적).
                </p>
                <p>
                  <strong>근사검정 → Wald·Wilson:</strong> 크기가 근사적으로만 α이므로 포함률 보장이 없습니다. 분모에 p̂을 쓰는 Wald는 p가 0·1 근처에서 특히 무너집니다.
                </p>
                <p>
                  <strong>사후분포 → Jeffreys·Beta:</strong> 보장되는 것은 사후질량 95%이지 고정 p에서의 포함률이 아닙니다. ‘경계 사례’ 프리셋에서 사후질량 95%인 구간의 포함률이 90.4%로 떨어지는 것을 확인하세요.
                </p>
              </>
            }
          />
          <Fold title="근사 피듀셜과 Jeffreys — 숫자는 같아도 근거는 다르다">
            <p>근사 피듀셜 분포 Beta(x + 1/2, n − x + 1/2)는 Jeffreys 사후분포와 숫자가 같습니다. 하지만 Jeffreys는 사전분포 Beta(1/2, 1/2)를 정한 베이즈 계산이고, 피듀셜은 사전분포 없이 자료와 모수의 관계를 뒤집는 구성이라 근거와 해석이 다릅니다.</p>
            <p>이것을 ‘피셔의 유일한 이항구간’이라고 부르지 않습니다. Clopper–Pearson 논문(1934)의 제목에도 ‘confidence or fiducial limits’가 들어 있어, CP를 네이만 전용으로 단순 분류하지도 않습니다.</p>
          </Fold>
          <Fold title="경계 처리 정책">
            <ul>
              <li>Jeffreys는 x = 0, n에서도 사후 분위수를 그대로 쓰는 미수정 모드가 기본입니다. 끝을 0·1로 바꾸는 것은 ‘Jeffreys 경계 수정 (변형)’으로 따로 둡니다.</li>
              <li>Wald는 [0, 1] 밖으로 나가도 잘라내지 않습니다. 잘라낸 것은 ‘Wald 잘라냄 (변형)’입니다. x = 0, n에서는 길이 0으로 퇴화합니다.</li>
              <li>CP는 정의상 x = 0이면 L = 0, x = n이면 U = 1입니다.</li>
              <li>
                경계 수정이 포함률을 바꾸는 것은 p가 Jeffreys의 x = 0 하한보다 작을 때(그리고 대칭으로 1 − p가 작을 때)뿐입니다. 지금 설정에서 그 하한은 {compareBelt(n, s.level, 'jeffreys')[0].lower.toExponential(2)}이라, 격자(최소 p = 0.001)에서는 두 곡선이 {compareBelt(n, s.level, 'jeffreys')[0].lower < 0.001 ? '같게 보입니다' : '달라집니다'}.
              </li>
            </ul>
          </Fold>
        </aside>
      </div>
    </>
  )
}
