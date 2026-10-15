// E08 추정 대상이 다른 구간 (PRD v2 §7 E08): P0 개념 · P1 예측구간 계산 · P2 허용구간 계산
import { useMemo, useRef } from 'react'
import { randomSeed } from '../engine/core/rng'
import { meanInterval, type Method } from '../engine/meanInterval'
import { mcSe, replicateData } from '../engine/repeat'
import { ciCoversNewObs, newObservation, populationMass, predictionInterval } from '../engine/targets'
import { MassHist } from '../components/chart/MassHist'
import { PI_COLOR, PairStack, type PairItem } from '../components/chart/PairStack'
import { SampleDots } from '../components/chart/SampleDots'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { predictionCsv } from '../lib/exports'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useReplicates } from '../lib/useReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'
import { ToleranceSection } from './ToleranceSection'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const ROWS = 40

const KINDS = [
  { name: '신뢰구간', en: 'confidence interval', target: '고정된 모수', q: '이 절차는 참모수를 얼마나 자주 포함하는가?', status: '계산 · E01–E06' },
  { name: '신용구간', en: 'credible interval', target: '모수에 대한 사후 불확실성', q: '자료와 사전분포 아래에서 사후질량은 얼마인가?', status: '계산 · E07' },
  { name: '예측구간', en: 'prediction interval', target: '미래 관측값 하나', q: '새 관측값을 얼마나 자주 포함하는가?', status: '계산 · 아래' },
  { name: '허용구간', en: 'tolerance interval', target: '모집단의 일정 비율 β', q: '적어도 β의 모집단 질량을 신뢰수준 γ로 포함하는가?', status: '계산 · 아래 (P2)' },
]

export function E08({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const { mu, sigma, n, level, method } = s
  const gen = { mu, sigma, n, seed: s.seed }
  const reps = useReplicates(gen, s.seed >= 0 ? s.k : 0)
  const count = reps.count
  const { xbar: repX, s: repS } = reps

  const res = useMemo(() => {
    const rows: { b: number; xbar: number; se: number; ci: { lower: number; upper: number }; pi: { lower: number; upper: number }; y: number }[] = []
    const piMass = new Float64Array(count)
    const ciMass = new Float64Array(count)
    let ciMu = 0
    let ciY = 0
    let piMu = 0
    let piY = 0
    let piMassGe = 0
    for (let b = 0; b < count; b++) {
      const sd = method === 'z' ? sigma : repS[b]
      const ci = meanInterval(method, repX[b], sd, n, level)
      const pi = predictionInterval(method, repX[b], sd, n, level)
      const y = newObservation(s.seed, b, mu, sigma)
      if (ci.lower <= mu && mu <= ci.upper) ciMu++
      if (ci.lower <= y && y <= ci.upper) ciY++
      if (pi.lower <= mu && mu <= pi.upper) piMu++
      if (pi.lower <= y && y <= pi.upper) piY++
      piMass[b] = populationMass(pi, mu, sigma)
      ciMass[b] = populationMass(ci, mu, sigma)
      if (piMass[b] >= level) piMassGe++
      rows.push({ b, xbar: repX[b], se: sd / Math.sqrt(n), ci, pi, y })
    }
    let pm = 0
    let cm = 0
    for (let b = 0; b < count; b++) {
      pm += piMass[b]
      cm += ciMass[b]
    }
    return { rows, piMass, ciMu, ciY, piMu, piY, piMassGe, piMassMean: count ? pm / count : NaN, ciMassMean: count ? cm / count : NaN }
  }, [repX, repS, count, method, sigma, n, level, mu, s.seed])

  const items: PairItem[] = res.rows.slice(Math.max(0, count - ROWS)).map((r) => ({ b: r.b, ci: r.ci, pi: r.pi, y: r.y }))
  const zPi = predictionInterval('z', 1, 1, n, level)
  const piHalf = (zPi.upper - zPi.lower) / 2
  const domain: [number, number] = [mu - Math.max(3.6 * sigma, piHalf * sigma * 1.15 + sigma), mu + Math.max(3.6 * sigma, piHalf * sigma * 1.15 + sigma)]
  const sel = s.sel >= 0 && s.sel < count ? s.sel : -1
  const selRow = sel >= 0 ? res.rows[sel] : null
  const selData = sel >= 0 ? replicateData(gen, sel) : null
  const inCiShare = selData && selRow ? selData.filter((v) => selRow.ci.lower <= v && v <= selRow.ci.upper).length / selData.length : NaN

  const draw = (m: number) => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + m), seed: c.seed < 0 ? randomSeed() : c.seed }))
  useShortcuts({ Space: () => draw(1), t: () => draw(10) }, present)

  const theo = ciCoversNewObs(level, n)
  const L = `${Math.round(level * 1000) / 10}%`
  const fixedCi = meanInterval('z', 100, 25, 25, 0.95)

  return (
    <>
      <Predict
        experimentId="E08"
        itemId="E08-P1"
        question={`x̄ = 100, σ = 25, n = 25의 95% 신뢰구간은 [${f4(fixedCi.lower)}, ${f4(fixedCi.upper)}]입니다. 이 절차로 만든 신뢰구간이 모집단에서 새로 뽑은 관측값 하나를 포함할 확률은?`}
        choices={[
          { text: '95%', misconception: 'M3', feedback: '95%는 구간이 모평균 μ를 포함하는 비율입니다. 개별 관측값은 μ 주변에 σ만큼 퍼져 있어서, 모평균의 구간은 대부분의 관측값을 놓칩니다.' },
          { text: '약 30%', correct: true, feedback: `Y − X̄ ~ N(0, σ²(1 + 1/n))이므로 P(Y ∈ C) = 2Φ(q/√(n+1)) − 1 ≈ ${pct(ciCoversNewObs(0.95, 25))}입니다. 새 관측값을 대상으로 하려면 폭이 √(n+1)배인 예측구간이 필요합니다.` },
          { text: '거의 0%', feedback: '그렇게 낮지는 않습니다. 구간의 폭이 σ에 비해 좁을 뿐, 관측값이 구간 안에 떨어지는 경우도 꽤 있습니다.' },
          { text: '100%', misconception: 'M3', feedback: '신뢰구간은 모집단 전체를 덮는 구간이 아닙니다. 모평균의 불확실성만 반영합니다.' },
        ]}
        revealed={count >= 100}
        waitHint="‘100회’를 눌러 반복표집으로 확인하세요."
        resultSummary={count ? `이번 반복표집에서 신뢰구간이 새 관측값을 포함한 비율은 ${pct(res.ciY / count)} (이론값 ${pct(theo)})입니다.` : ''}
      />

      <section className="kinds-grid" aria-label="구간 네 종류">
        {KINDS.map((k) => (
          <article key={k.name} className="panel kind-card">
            <p className="eyebrow">{k.en}</p>
            <h3>{k.name}</h3>
            <p className="kind-target">
              <b>대상</b> {k.target}
            </p>
            <p className="kind-q">“{k.q}”</p>
            <span className={`badge ${k.status.startsWith('개념') ? 'badge-gray' : 'badge-blue'}`}>{k.status}</span>
          </article>
        ))}
      </section>

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>설정</h2>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-outline sm" onClick={() => update({ mu: 100, sigma: 25, n: 25, level: 0.95, method: 'z', k: 0, sel: -1 })}>
              기준 (N(100, 25²), n=25)
            </button>
            <button type="button" className="btn-outline sm" onClick={() => update({ n: 5, method: 't', k: 0, sel: -1 })}>
              작은 표본 t (n=5)
            </button>
          </div>
          <SliderField label="모평균 μ (교육용)" value={mu} min={-1000} max={1000} step={1} onChange={(v) => update({ mu: v })} />
          <SliderField label="모표준편차 σ" value={sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
          <SliderField label="표본크기 n" value={n} min={LIMITS.n[0]} max={200} step={1} onChange={(v) => update({ n: v })} />
          <Segmented<Method>
            label="방법"
            value={method}
            options={[
              { value: 'z', label: 'z (σ 알려짐)' },
              { value: 't', label: 't (σ를 S로)' },
            ]}
            onChange={(v) => update({ method: v })}
          />
          <SliderField label="수준 1−α (= β)" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <AssumptionBadges items={['정규 모집단', '독립 표본', '새 관측값도 같은 모집단에서 독립']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="신뢰구간과 예측구간">
          <div className="run-bar" role="group" aria-label="표본과 새 관측값 뽑기">
            {[1, 10, 100, 1000].map((m) => (
              <button key={m} type="button" className={m === 1 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => draw(m)}>
                {m.toLocaleString('ko-KR')}회
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => update({ k: 0, sel: -1 })} disabled={count === 0}>
              초기화
            </button>
          </div>
          <PairStack svgRef={svgRef} items={items} rows={ROWS} truth={mu} domain={domain} selected={sel} onSelect={(b) => update({ sel: b === sel ? -1 : b })} ariaLabel={`최근 ${items.length}개 반복의 신뢰구간과 예측구간, 모평균 μ = ${mu}`} />
          <Legend
            items={[
              { color: 'var(--c-truth)', label: '모평균 μ (고정)', pattern: 'fill' },
              { color: 'var(--c-cover)', label: '신뢰구간 (굵은 선, μ를 놓치면 주황)', pattern: 'fill' },
              { color: PI_COLOR, label: '예측구간 (얇은 선)', pattern: 'fill' },
              { color: PI_COLOR, label: '○ 새 관측값 Y (예측구간 밖이면 ✕)' },
            ]}
          />

          <h3 className="chart-title">구간 × 대상: 무엇을 얼마나 자주 포함했나</h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="구간과 대상의 포함 비율 표">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col">구간</th>
                  <th scope="col">모평균 μ를 포함</th>
                  <th scope="col">새 관측값 Y를 포함</th>
                  <th scope="col">덮은 모집단 비율 (평균)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">신뢰구간</th>
                  <td className="num target-hit">{count ? `${pct(res.ciMu / count)} ±${(2 * mcSe(res.ciMu, count) * 100).toFixed(2)}` : '—'}</td>
                  <td className="num">{count ? pct(res.ciY / count) : '—'}{method === 'z' ? ` (이론 ${pct(theo)})` : ''}</td>
                  <td className="num">{pct(res.ciMassMean)}</td>
                </tr>
                <tr>
                  <th scope="row">예측구간</th>
                  <td className="num">{count ? pct(res.piMu / count) : '—'}</td>
                  <td className="num target-hit">{count ? `${pct(res.piY / count)} ±${(2 * mcSe(res.piY, count) * 100).toFixed(2)}` : '—'}</td>
                  <td className="num">{pct(res.piMassMean)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="chart-caption">
            굵은 칸이 각 구간의 대상입니다. 둘 다 그 대상을 {L}로 포함하도록 만들어졌습니다(±는 2 MC 표준오차, 반복 {fmtInt(count)}회). 신뢰구간으로 새 관측값을 예측하면 대부분 놓칩니다.
          </p>

          <h3 className="chart-title">예측구간이 덮은 모집단 비율 — 허용구간과의 차이 (개념)</h3>
          {count ? (
            <>
              <MassHist values={res.piMass} beta={level} color={PI_COLOR} ariaLabel={`예측구간 ${count}개가 덮은 모집단 비율의 분포`} />
              <StatGrid
                stats={[
                  { tag: '평균 덮은 비율', label: '= 새 관측값 포함률', value: pct(res.piMassMean, 2) },
                  { tag: `β = ${L} 이상을 덮은 반복`, label: '허용구간이 정하는 확률 γ', value: pct(res.piMassGe / count), tone: 'orange', sub: method === 'z' && n === 25 && level === 0.95 ? '이론 68.4%' : undefined },
                ]}
              />
              <p className="chart-caption">예측구간은 모집단의 {L}를 평균적으로 덮지만, 한 번 만든 구간이 실제로 {L} 이상을 덮는지는 보장하지 않습니다. 허용구간은 ‘모집단의 β 이상을 덮을 확률이 γ 이상’이 되도록 더 넓게 만든 구간으로, β와 γ 두 수준을 따로 정합니다(아래).</p>
            </>
          ) : (
            <p className="chart-caption">표본을 뽑으면 나타납니다.</p>
          )}
          <ToleranceSection s={s} update={update} reps={reps} />

          {selRow && selData && (
            <>
              <h3 className="chart-title">#{sel + 1}의 원자료 {n}개 — 관측값이 신뢰구간 안에 몇 개 있나</h3>
              <SampleDots data={selData} ci={selRow.ci} pi={selRow.pi} domain={domain} ariaLabel={`반복 ${sel + 1}의 원자료 ${n}개, 신뢰구간 안 ${pct(inCiShare)}`} />
              <p className="chart-caption">
                채운 점 = 신뢰구간 [{f4(selRow.ci.lower)}, {f4(selRow.ci.upper)}] 안의 관측값, {pct(inCiShare)}. ‘관측값의 {L}가 신뢰구간 안에 있다’는 해석은 틀립니다(M3). 점선 상자는 예측구간 [{f4(selRow.pi.lower)}, {f4(selRow.pi.upper)}]입니다.
              </p>
            </>
          )}
          {!selRow && count > 0 && <p className="chart-caption">그림에서 한 반복을 누르면 그 반복의 원자료와 두 구간을 볼 수 있습니다.</p>}

          <ExportBar s={s} update={update} experimentId="E08" svgRef={svgRef} csv={count ? () => predictionCsv(s, res.rows) : undefined} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>Space</kbd> 1회 · <kbd>T</kbd> 10회
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.1·8.2 (모평균 구간) · 확장: 예측·허용구간</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>무엇을 덮으려는 구간인가</h2>
          <ExplainTabs
            intuition={
              <>
                <p>신뢰구간은 모평균 하나의 위치에 대한 불확실성만 담습니다. n이 커지면 폭이 0으로 줄어듭니다.</p>
                <p>새 관측값 하나는 모평균이 정확히 알려져도 σ만큼 흩어집니다. 그래서 예측구간에는 x̄의 불확실성(σ²/n)에 관측값 자체의 흩어짐(σ²)이 더해지고, n이 커져도 폭이 2qσ 아래로 줄지 않습니다.</p>
                <p className="muted">신용구간은 E07, 허용구간은 β·γ 두 수준을 가진 별도의 대상입니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`\text{신뢰: } \bar x \pm q\,\frac{\sigma}{\sqrt n}`}</Tex>
                <Tex block>{String.raw`\text{예측: } \bar x \pm q\,\sigma\sqrt{1 + \tfrac1n}`}</Tex>
                <p>
                  현재 설정({method === 'z' ? 'σ 사용' : 'S 사용, t 분위수'}): 신뢰구간 폭 {method === 'z' ? f4(2 * meanInterval('z', 0, sigma, n, level).upper) : '반복마다 다름'}, 예측구간 폭 {method === 'z' ? f4(2 * predictionInterval('z', 0, sigma, n, level).upper) : '반복마다 다름'} (비 √(n+1) = {f4(Math.sqrt(n + 1))})
                </p>
              </>
            }
            proof={
              <>
                <p>Y와 X̄가 독립이고 Y ~ N(μ, σ²), X̄ ~ N(μ, σ²/n)이면</p>
                <Tex block>{String.raw`Y - \bar X \sim N\!\left(0,\ \sigma^2\left(1+\tfrac1n\right)\right)`}</Tex>
                <Tex block>{String.raw`P\!\left(|Y-\bar X| \le q\,\sigma\sqrt{1+\tfrac1n}\right) = 1-\alpha`}</Tex>
                <p>같은 식에서 신뢰구간의 반폭 qσ/√n을 쓰면 P(Y ∈ C) = 2Φ(q/√(n+1)) − 1입니다. σ를 모르면 (Y − X̄)/(S√(1 + 1/n)) ~ t(n − 1)을 씁니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
