// E09 가정 위반과 대표본 근사 (PRD v2 §7 E09, P1)
import { useMemo, useRef } from 'react'
import { randomSeed } from '../engine/core/rng'
import { mcSe, missSide } from '../engine/repeat'
import { POPULATIONS, ROBUST_METHODS, quantilesFor, robustInterval, robustStats, type Population } from '../engine/robust'
import { CoverageByNChart, PopDensityChart, type CovSeries } from '../components/chart/RobustCharts'
import { IntervalStack, type StackItem } from '../components/chart/IntervalStack'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Segmented, SliderField, Tex, TextbookBadge } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { COVERAGE_B, useCoverageByN, usePopReplicates } from '../lib/useRobust'
import { LIMITS, type LabState, type Update } from '../state/labState'

const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const ROWS = 40
const fmtK = (v: number) => (v === Infinity ? '∞' : fmtNum(v, 2))

export function E09({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const { pop, mu, sigma, n, level, tg } = s
  const meta = POPULATIONS.find((p) => p.id === pop)!
  const methods = ROBUST_METHODS.filter((m) => m.target === tg)
  const main = tg === 'var' ? 'chi2' : 't'
  const truth = tg === 'var' ? sigma * sigma : mu

  const reps = usePopReplicates({ pop, mu, sigma, n, seed: s.seed }, s.k)
  const count = reps.count
  const q = useMemo(() => quantilesFor(n, level), [n, level])
  const stats = useMemo(() => methods.map((m) => ({ m, st: robustStats(m.id, reps, count, n, mu, sigma, level, q) })), [reps, count, n, mu, sigma, level, q, tg]) // eslint-disable-line react-hooks/exhaustive-deps
  const items: StackItem[] = []
  for (let b = Math.max(0, count - ROWS); b < count; b++) {
    const iv = robustInterval(main, reps.xbar[b], reps.s[b], n, sigma, q)
    items.push({ b, lower: iv.lower, upper: iv.upper, side: missSide(iv, truth) })
  }
  const se = sigma / Math.sqrt(n)
  const domain: [number, number] = tg === 'var' ? [0, sigma * sigma * (n < 10 ? 6 : 3.2)] : [mu - 5 * se, mu + 5 * se]

  const { rows, computing } = useCoverageByN(pop, level)
  const series: CovSeries[] = rows
    ? methods.map((m) => ({
        label: m.label,
        color: m.color,
        dash: m.dash,
        points: rows.map((r) => ({ n: r.n, c: r.stats[m.id].covered / COVERAGE_B, se: mcSe(r.stats[m.id].covered, COVERAGE_B) })),
      }))
    : []
  const tRow = rows?.find((r) => r.n === 10)

  const draw = (k: number) => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + k), seed: c.seed < 0 ? randomSeed() : c.seed }))
  useShortcuts({ Space: () => draw(100) }, present)
  const mainSt = stats.find((x) => x.m.id === main)?.st

  return (
    <>
      <Predict
        experimentId="E09"
        itemId="E09-P1"
        question="평균·분산을 맞춘 지수 모집단에서 n = 10으로 95% t 구간을 만들면, 실제 포함률은?"
        choices={[
          { text: '95% 그대로다 (평균과 분산을 맞췄으니까)', misconception: 'M6', feedback: 't 구간의 포함률은 평균·분산만이 아니라 분포의 모양(왜도)에 따라 달라집니다. 작은 n에서는 맞춘 평균·분산만으로 충분하지 않습니다.' },
          { text: '약 90%이고, 놓치는 쪽이 한쪽으로 쏠린다', correct: true, feedback: `오른쪽으로 치우친 모집단에서는 x̄과 S가 함께 움직여, 구간이 참값보다 왼쪽에 있는(U < μ) 경우가 훨씬 많습니다.${tRow ? ` 이 사이트의 MC: 포함률 ${pct(tRow.stats.t.covered / COVERAGE_B)}, 좌측 ${pct(tRow.stats.t.missLeft / COVERAGE_B)}, 우측 ${pct(tRow.stats.t.missRight / COVERAGE_B)}.` : ''}` },
          { text: '95%보다 높아진다 (보수적이 된다)', misconception: 'M6', feedback: '지수 모집단에서는 반대로 명목수준보다 낮아집니다.' },
          { text: '50%도 안 된다', feedback: '그 정도로 무너지는 것은 평균이 아니라 분산의 χ² 구간 쪽입니다. ‘대상’을 분산으로 바꿔 보세요.' },
        ]}
        revealed={!!rows}
        waitHint="표본크기별 포함률 계산을 기다리는 중입니다."
        resultSummary={tRow ? `지수 n = 10의 t 구간 포함률은 ${pct(tRow.stats.t.covered / COVERAGE_B)}입니다(현재 모집단 기준 아래 그림 참고).` : ''}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>모집단과 대상</h2>
          <Segmented<Population> label="모집단" value={pop} options={POPULATIONS.map((p) => ({ value: p.id, label: p.label.replace(/ \(.*\)/, '') }))} onChange={(v) => update({ pop: v })} />
          <Segmented<'mean' | 'var'>
            label="대상"
            value={tg}
            options={[
              { value: 'mean', label: '평균 μ' },
              { value: 'var', label: '분산 σ²' },
            ]}
            onChange={(v) => update({ tg: v })}
          />
          <SliderField label="표본크기 n" value={n} min={LIMITS.n[0]} max={200} step={1} onChange={(v) => update({ n: v })} />
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <SliderField label="평균 μ (맞춤)" value={mu} min={-1000} max={1000} step={1} onChange={(v) => update({ mu: v })} />
          <SliderField label="표준편차 σ (맞춤)" value={sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
          <table className="data-table compare-table" style={{ marginTop: 6 }}>
            <caption className="sr-only">맞춘 특성과 맞추지 않은 특성</caption>
            <tbody>
              <tr>
                <th scope="row">평균 · 분산</th>
                <td>맞춤 ✓</td>
              </tr>
              <tr>
                <th scope="row">왜도</th>
                <td className="num">{fmtK(meta.skew)}</td>
              </tr>
              <tr>
                <th scope="row">초과첨도</th>
                <td className="num">{fmtK(meta.exKurt)}</td>
              </tr>
            </tbody>
          </table>
          <PopDensityChart pop={pop} mu={mu} sigma={sigma} ariaLabel={`${meta.label} 모집단의 밀도와 같은 평균·분산의 정규분포(점선)`} />
          <p className="field-hint">채운 곡선: {meta.label} · 점선: 같은 평균·분산의 정규분포</p>
          <AssumptionBadges items={[tg === 'mean' ? 't 구간은 정규 모집단을 가정' : 'χ² 구간은 정규 모집단을 가정', '독립 표본']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="가정 위반의 영향">
          <h3 className="chart-title" style={{ marginTop: 0 }}>
            표본크기별 포함률 — {meta.label}, 대상 {tg === 'mean' ? '평균' : '분산'}
          </h3>
          {series.length ? (
            <CoverageByNChart svgRef={svgRef} series={series} level={level} mark={n} ariaLabel={`${meta.label} 모집단에서 표본크기별 포함률. ${series.map((x) => `${x.label}: n = 10에서 ${pct(x.points.find((p) => p.n === 10)?.c ?? NaN)}`).join(', ')}`} />
          ) : (
            <p className="chart-caption" role="status">
              계산 중… (n마다 {fmtInt(COVERAGE_B)}회)
            </p>
          )}
          <div className="chart-legend">
            {methods.map((m) => (
              <span key={m.id}>
                <span className="legend-swatch" style={{ background: 'transparent', borderTop: `2px ${m.dash ? 'dashed' : 'solid'} ${m.color}`, height: 0, marginBottom: 3 }} />
                {m.label}
              </span>
            ))}
            {computing && rows && <span>새 설정으로 계산 중…</span>}
          </div>
          <p className="chart-caption">
            몬테카를로 추정입니다(n마다 {fmtInt(COVERAGE_B)}회, 고정 seed, 세로 막대 ±2 MC 표준오차). 유한 시뮬레이션의 결과이며 이론적 보장이 아닙니다.{' '}
            {tg === 'var' ? '분산의 χ² 구간은 n을 늘려도 명목수준으로 돌아오지 않습니다. 4차 적률(첨도)에 의존하기 때문입니다.' : '평균의 구간은 n이 커지면 중심극한정리로 명목수준에 다가갑니다.'}
          </p>

          <div className="run-bar" role="group" aria-label="현재 n에서 표본 뽑기" style={{ marginTop: 12 }}>
            <span className="kbd-help">n = {n}에서 반복표집:</span>
            {[10, 100, 1000].map((k) => (
              <button key={k} type="button" className={k === 100 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => draw(k)}>
                {k.toLocaleString('ko-KR')}회
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => update({ k: 0 })} disabled={count === 0}>
              초기화
            </button>
          </div>
          <IntervalStack items={items} rows={ROWS} truth={truth} hideTruth={false} domain={domain} selected={-1} onSelect={() => undefined} ariaLabel={`${meta.label} 모집단에서 ${ROBUST_METHODS.find((m) => m.id === main)!.label} 최근 ${items.length}개`} />

          <div className="table-scroll" tabIndex={0} role="region" aria-label="방법별 성능 표">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col">방법 (n = {n})</th>
                  <th scope="col">포함률</th>
                  <th scope="col">평균 길이</th>
                  <th scope="col">좌측 P(L &gt; θ)</th>
                  <th scope="col">우측 P(U &lt; θ)</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ m, st }) => (
                  <tr key={m.id}>
                    <th scope="row">{m.label}</th>
                    <td className={`num${count && st.covered / count < level - 2 * mcSe(st.covered, count) ? ' under' : ''}`}>{count ? `${pct(st.covered / count)} ±${(2 * mcSe(st.covered, count) * 100).toFixed(1)}` : '—'}</td>
                    <td className="num">{count ? fmtNum(st.meanLength, 3) : '—'}</td>
                    <td className="num">{count ? pct(st.missLeft / count) : '—'}</td>
                    <td className="num">{count ? pct(st.missRight / count) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mainSt && count > 0 && (
            <p className="chart-caption">
              명목상 좌우 비포함은 각각 {pct((1 - level) / 2)}입니다. {Math.abs(mainSt.missLeft - mainSt.missRight) > 4 * Math.sqrt(count * 0.025) ? <strong>비포함이 {mainSt.missRight > mainSt.missLeft ? '오른쪽(U < θ)' : '왼쪽(L > θ)'}으로 쏠렸습니다.</strong> : '좌우 비포함이 비슷합니다.'} 반복 {fmtInt(count)}회.
            </p>
          )}
          <ExportBar s={s} update={update} experimentId="E09" svgRef={svgRef} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>Space</kbd> 100회
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.2.2 · 8.3 · 8.4.2</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>가정이 깨지면 무엇이 무너지나</h2>
          <ExplainTabs
            intuition={
              <>
                <p>평균과 분산을 똑같이 맞춰도 모양(왜도, 꼬리의 두께)이 다르면 구간의 성능이 달라집니다.</p>
                <p>오른쪽으로 치우친 모집단에서는 큰 관측값이 섞이면 x̄과 S가 함께 커집니다. 그래서 x̄이 작을 때 구간이 좁아져 μ를 왼쪽에 두고 놓치는 일이 많아집니다(U &lt; μ).</p>
                <p>평균의 구간은 n이 커지면 중심극한정리로 회복되지만, 분산의 χ² 구간은 첨도에 직접 의존해서 n이 커져도 회복되지 않습니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`\text{t: } \bar x \pm t_{n-1}\frac{s}{\sqrt n},\quad \text{8.2.2: } \bar x \pm z\,\frac{s}{\sqrt n}`}</Tex>
                <Tex block>{String.raw`\sigma^2 \in \left[\frac{(n-1)s^2}{Q_{1-\alpha/2}(\chi^2_{n-1})},\ \frac{(n-1)s^2}{Q_{\alpha/2}(\chi^2_{n-1})}\right]`}</Tex>
                <p>
                  n = {n}: t = {fmtNum(q.t, 4)}, z = {fmtNum(q.z, 4)}, χ² 분위수 {fmtNum(q.chiLo, 3)} · {fmtNum(q.chiHi, 3)}
                </p>
              </>
            }
            proof={
              <>
                <p>중심극한정리: √n(X̄ − μ)/S → N(0, 1) (분포수렴). 그래서 평균의 구간은 큰 n에서 근사적으로 1 − α를 지킵니다. 수렴 속도는 왜도에 따라 다릅니다.</p>
                <p>
                  (n − 1)S²/σ²의 분산은 정규에서 2(n − 1)이지만 일반 모집단에서는 근사적으로 (n − 1)(2 + κ)입니다(κ = 초과첨도). χ²(n − 1) 분위수는 κ = 0을 가정하므로, κ ≠ 0이면 n이 커져도 포함률이 1 − α로 가지 않습니다.
                </p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
