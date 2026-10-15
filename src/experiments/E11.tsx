// E11 두 모집단 (PRD v2 §7 E11, P1): 독립 두 평균, 대응 표본, 두 모비율의 차. 분산비 F는 E03으로 연결
import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { randomSeed } from '../engine/core/rng'
import { mcSe, missSide } from '../engine/repeat'
import { IND_METHODS, indInterval, pairedInterval, propDiffCoverage, propDiffNewcombe, propDiffWald, sePaired, seIndependent, type IndMethod } from '../engine/twoSample'
import { DesignCurveChart } from '../components/chart/DesignCurveChart'
import { IntervalStack, type StackItem } from '../components/chart/IntervalStack'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useTwoReplicates } from '../lib/useTwoReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const ROWS = 30

type Perf = { covered: number; ml: number; mr: number; len: number }
const emptyPerf = (): Perf => ({ covered: 0, ml: 0, mr: 0, len: 0 })
function add(p: Perf, lo: number, hi: number, truth: number) {
  p.len += hi - lo
  if (lo > truth) p.ml++
  else if (hi < truth) p.mr++
  else p.covered++
}

export function E11({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const de = s.de
  const level = s.level
  const delta = de === 'prop' ? s.pp1 - s.pp2 : s.mu - s.mu2
  const n1 = s.n
  const n2 = de === 'pair' ? s.n : s.n2
  const spec = { mu1: s.mu, mu2: s.mu2, sigma1: s.sigma, sigma2: s.sg2, n1, n2, rho: de === 'pair' ? s.rho : 0, paired: de === 'pair', seed: s.seed }
  const { rep, count } = useTwoReplicates(spec, de === 'prop' ? 0 : s.k)

  const perf = useMemo(() => {
    const out: Record<string, Perf> = { pooled: emptyPerf(), welch: emptyPerf(), zlarge: emptyPerf(), paired: emptyPerf() }
    for (let b = 0; b < count; b++) {
      const t = { x1: rep.x1[b], s1: rep.s1[b], n1, x2: rep.x2[b], s2: rep.s2[b], n2 }
      for (const m of ['pooled', 'welch', 'zlarge'] as IndMethod[]) {
        const iv = indInterval(m, t, level)
        add(out[m], iv.lower, iv.upper, delta)
      }
      if (de === 'pair') {
        const iv = pairedInterval(rep.x1[b] - rep.x2[b], rep.sd[b], n1, level)
        add(out.paired, iv.lower, iv.upper, delta)
      }
    }
    return out
  }, [rep, count, n1, n2, level, delta, de])

  const stack = (m: IndMethod | 'paired'): StackItem[] => {
    const items: StackItem[] = []
    for (let b = Math.max(0, count - ROWS); b < count; b++) {
      const iv = m === 'paired' ? pairedInterval(rep.x1[b] - rep.x2[b], rep.sd[b], n1, level) : indInterval(m, { x1: rep.x1[b], s1: rep.s1[b], n1, x2: rep.x2[b], s2: rep.s2[b], n2 }, level)
      items.push({ b, lower: iv.lower, upper: iv.upper, side: missSide(iv, delta) })
    }
    return items
  }
  const seI = seIndependent(s.sigma, n1, s.sg2, n2)
  const seP = sePaired(s.sigma, s.sg2, s.rho, n1)
  const stackDomain: [number, number] = [delta - 5 * Math.max(seI, de === 'pair' ? seP : 0), delta + 5 * Math.max(seI, de === 'pair' ? seP : 0)]

  const draw = (k: number) => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + k), seed: c.seed < 0 ? randomSeed() : c.seed }))
  useShortcuts({ Space: () => de !== 'prop' && draw(100) }, present)

  // 두 비율: 정확 포함률
  const propCov = useMemo(() => (de === 'prop' ? propDiffCoverage(s.pp1, n1, s.pp2, n2, level) : null), [de, s.pp1, s.pp2, n1, n2, level])
  const propCovN = useMemo(() => (de === 'prop' ? propDiffCoverage(s.pp1, n1, s.pp2, n2, level, 'newcombe') : null), [de, s.pp1, s.pp2, n1, n2, level])
  const ex1 = Math.round(n1 * s.pp1)
  const ex2 = Math.round(n2 * s.pp2)
  const propIv = propDiffWald(ex1, n1, ex2, n2, level)
  const propIvN = propDiffNewcombe(ex1, n1, ex2, n2, level)

  const row = (label: string, p: Perf) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td className={`num${count && p.covered / count < level - 2 * mcSe(p.covered, count) ? ' under' : ''}`}>{count ? `${pct(p.covered / count)} ±${(2 * mcSe(p.covered, count) * 100).toFixed(1)}` : '—'}</td>
      <td className="num">{count ? fmtNum(p.len / count, 3) : '—'}</td>
      <td className="num">{count ? pct(p.ml / count) : '—'}</td>
      <td className="num">{count ? pct(p.mr / count) : '—'}</td>
    </tr>
  )

  return (
    <>
      <div className="model-switch" style={{ maxWidth: 560 }}>
        <Segmented<LabState['de']>
          label="설계"
          value={de}
          options={[
            { value: 'ind', label: '독립 두 평균' },
            { value: 'pair', label: '대응 (짝비교)' },
            { value: 'prop', label: '두 모비율의 차' },
          ]}
          onChange={(v) => update({ de: v, k: 0 })}
        />
      </div>

      {de === 'ind' && (
        <Predict
          experimentId="E11"
          itemId="E11-P1"
          question="n₁ = 25(σ₁ = 10), n₂ = 8(σ₂ = 30)처럼 등분산이 깨지고 작은 표본의 분산이 클 때, 합동(pooled) t 95% 구간의 실제 포함률은?"
          choices={[
            { text: '95% 그대로다', misconception: 'M6', feedback: '합동 분산 S_p²는 큰 표본(분산이 작은 쪽)에 끌려가 SE를 과소추정합니다. 그래서 구간이 너무 좁아집니다.' },
            { text: '80%대로 크게 떨어진다', correct: true, feedback: '등분산 가정이 깨지고 표본크기까지 불균형하면 pooled t는 크게 무너집니다. Welch t는 각 표본의 분산을 따로 써서 명목수준을 거의 지킵니다.' },
            { text: '95%보다 높아진다', feedback: '반대 경우(큰 표본의 분산이 클 때)에는 그렇습니다. ‘큰 표본의 분산이 큼’ 프리셋으로 확인해 보세요.' },
            { text: 'Welch t도 똑같이 무너진다', misconception: 'M6', feedback: 'Welch t는 등분산을 가정하지 않아 이 상황에서도 거의 95%를 지킵니다.' },
          ]}
          revealed={count >= 300}
          waitHint="‘작은 표본의 분산이 큼’ 프리셋에서 1,000회를 뽑아 보세요."
          resultSummary={count ? `이번 설정: pooled ${pct(perf.pooled.covered / count)}, Welch ${pct(perf.welch.covered / count)} (반복 ${fmtInt(count)}회).` : ''}
        />
      )}

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>{de === 'ind' ? '독립 두 표본' : de === 'pair' ? '대응 표본' : '두 모비율'}</h2>
          {de === 'ind' && (
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn-outline sm" onClick={() => update({ mu: 100, mu2: 100, sigma: 25, sg2: 25, n: 25, n2: 25, k: 0 })}>
                균형·등분산
              </button>
              <button type="button" className="btn-outline sm" onClick={() => update({ mu: 100, mu2: 100, sigma: 10, sg2: 30, n: 25, n2: 8, k: 0 })}>
                작은 표본의 분산이 큼
              </button>
              <button type="button" className="btn-outline sm" onClick={() => update({ mu: 100, mu2: 100, sigma: 30, sg2: 10, n: 25, n2: 8, k: 0 })}>
                큰 표본의 분산이 큼
              </button>
            </div>
          )}
          {de !== 'prop' ? (
            <>
              <SliderField label="μ₁ (교육용)" value={s.mu} min={-1000} max={1000} step={1} onChange={(v) => update({ mu: v })} />
              <SliderField label="μ₂ (교육용)" value={s.mu2} min={-1000} max={1000} step={1} onChange={(v) => update({ mu2: v })} />
              <SliderField label="σ₁" value={s.sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
              <SliderField label="σ₂" value={s.sg2} min={0.5} max={100} step={0.5} onChange={(v) => update({ sg2: v })} />
              <SliderField label={de === 'pair' ? '쌍의 수 n' : 'n₁'} value={s.n} min={2} max={200} step={1} onChange={(v) => update({ n: v })} />
              {de === 'ind' && <SliderField label="n₂" value={s.n2} min={2} max={200} step={1} onChange={(v) => update({ n2: v })} />}
              {de === 'pair' && <SliderField label="쌍 내 상관 ρ" value={s.rho} min={-0.95} max={0.95} step={0.05} onChange={(v) => update({ rho: v })} />}
            </>
          ) : (
            <>
              <SliderField label="p₁" value={s.pp1} min={0.01} max={0.99} step={0.01} onChange={(v) => update({ pp1: v })} />
              <SliderField label="p₂" value={s.pp2} min={0.01} max={0.99} step={0.01} onChange={(v) => update({ pp2: v })} />
              <SliderField label="n₁" value={s.n} min={2} max={200} step={1} onChange={(v) => update({ n: v })} />
              <SliderField label="n₂" value={s.n2} min={2} max={200} step={1} onChange={(v) => update({ n2: v })} />
            </>
          )}
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <AssumptionBadges items={de === 'ind' ? ['두 정규 모집단', '두 표본 서로 독립', 'pooled: 등분산'] : de === 'pair' ? ['쌍별 차이가 정규', '쌍끼리 독립'] : ['두 이항 표본 서로 독립', '대표본 근사']} />
          <div className="note" style={{ marginTop: 8, fontSize: '0.82rem' }}>
            분산비 σ₁²/σ₂²의 F 구간(교재 8.5)은 <Link to="/lab/e03?pv=f&n=10&sd=2&n2=8&sd2=1.5">E03 피벗(F)</Link>에서 다룹니다. 조건: 두 정규 모집단의 독립 표본.
          </div>
        </aside>

        <section className="col-chart panel chart-panel" aria-label="두 모집단 구간">
          {de !== 'prop' && (
            <div className="run-bar" role="group" aria-label="표본 뽑기">
              {[100, 1000].map((k) => (
                <button key={k} type="button" className={k === 100 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => draw(k)}>
                  {k.toLocaleString('ko-KR')}회
                </button>
              ))}
              <button type="button" className="btn-ghost" onClick={() => update({ k: 0 })} disabled={count === 0}>
                초기화
              </button>
              <span className="kbd-help">대상 δ = μ₁ − μ₂ = {fmtNum(delta, 3)} · 반복 {fmtInt(count)}회</span>
            </div>
          )}

          {de === 'ind' && (
            <>
              <div className="design-pair">
                {(['pooled', 'welch'] as IndMethod[]).map((m) => (
                  <div key={m}>
                    <h3 className="chart-title">{IND_METHODS.find((x) => x.id === m)!.label}</h3>
                    <IntervalStack svgRef={m === 'pooled' ? svgRef : undefined} items={stack(m)} rows={ROWS} truth={delta} hideTruth={false} domain={stackDomain} selected={-1} onSelect={() => undefined} ariaLabel={`${m} 구간 최근 ${Math.min(count, ROWS)}개`} />
                  </div>
                ))}
              </div>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="독립 두 평균 방법별 성능">
                <table className="data-table compare-table">
                  <thead>
                    <tr>
                      <th scope="col">방법</th>
                      <th scope="col">포함률</th>
                      <th scope="col">평균 길이</th>
                      <th scope="col">좌측 P(L &gt; δ)</th>
                      <th scope="col">우측 P(U &lt; δ)</th>
                    </tr>
                  </thead>
                  <tbody>{IND_METHODS.map((m) => row(m.label, perf[m.id]))}</tbody>
                </table>
              </div>
              {count > 0 && (
                <p className="chart-caption">
                  마지막 반복: pooled 자유도 {n1 + n2 - 2}, Welch 자유도 {f4(indInterval('welch', { x1: rep.x1[count - 1], s1: rep.s1[count - 1], n1, x2: rep.x2[count - 1], s2: rep.s2[count - 1], n2 }, level).df)}. σ₁ ≠ σ₂이고 n₁ ≠ n₂일수록 pooled t의 SE가 틀어집니다.
                </p>
              )}
            </>
          )}

          {de === 'pair' && (
            <>
              <StatGrid
                stats={[
                  { tag: '대응 설계의 SE', label: '√((σ₁² + σ₂² − 2ρσ₁σ₂)/n)', value: f4(seP) },
                  { tag: '독립이라면의 SE', label: '√(σ₁²/n + σ₂²/n)', value: f4(seI), tone: 'orange' },
                  { tag: '비', label: '대응 / 독립', value: f4(seP / seI) },
                ]}
              />
              <DesignCurveChart
                domain={[-0.95, 0.95]}
                series={[
                  { label: '대응', color: 'var(--c-cover)', f: (r) => sePaired(s.sigma, s.sg2, r, n1) },
                  { label: '독립', color: 'var(--c-miss)', dash: '6 3', f: () => seI },
                ]}
                marks={[{ x: s.rho, label: `ρ = ${s.rho}: ${fmtNum(seP, 3)}`, color: 'var(--c-truth)' }]}
                xTitle="쌍 내 상관 ρ (주변분산 고정)"
                yTitle="차이의 표준오차"
                xTickCount={6}
                ariaLabel={`쌍 내 상관에 따른 차이의 표준오차. ρ = ${s.rho}에서 대응 ${f4(seP)}, 독립 ${f4(seI)}`}
                height={210}
              />
              <p className="chart-caption">실선: 대응 설계의 SE · 점선: 같은 주변분산의 독립 설계 SE. 양의 상관이 클수록 짝을 지은 이득이 커집니다.</p>
              <div className="design-pair">
                <div>
                  <h3 className="chart-title">대응 t (올바른 분석)</h3>
                  <IntervalStack svgRef={svgRef} items={stack('paired')} rows={ROWS} truth={delta} hideTruth={false} domain={stackDomain} selected={-1} onSelect={() => undefined} ariaLabel="대응 t 구간" />
                </div>
                <div>
                  <h3 className="chart-title">같은 자료에 Welch t (설계를 무시)</h3>
                  <IntervalStack items={stack('welch')} rows={ROWS} truth={delta} hideTruth={false} domain={stackDomain} selected={-1} onSelect={() => undefined} ariaLabel="대응 자료에 잘못 쓴 Welch t 구간" />
                </div>
              </div>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="대응 설계 방법별 성능">
                <table className="data-table compare-table">
                  <thead>
                    <tr>
                      <th scope="col">방법</th>
                      <th scope="col">포함률</th>
                      <th scope="col">평균 길이</th>
                      <th scope="col">좌측 P(L &gt; δ)</th>
                      <th scope="col">우측 P(U &lt; δ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row('대응 t (쌍별 차이)', perf.paired)}
                    {row('Welch t — 설계를 무시 (쓰지 않음)', perf.welch)}
                  </tbody>
                </table>
              </div>
              <p className="chart-caption">독립과 대응 설계를 섞지 않습니다. 대응 자료에 독립 표본 방법을 쓰면 ρ &gt; 0일 때 SE를 과대추정해 구간이 쓸데없이 넓고(포함률은 명목보다 높음), ρ &lt; 0이면 반대로 너무 좁아집니다.</p>
            </>
          )}

          {de === 'prop' && propCov && propCovN && (
            <>
              <StatGrid
                stats={[
                  { tag: 'Wald (교재 8.6.2) 정확 포함률', label: `좌 ${pct(propCov.missLeft)} · 우 ${pct(propCov.missRight)}`, value: pct(propCov.coverage, 2), sub: `명목 ${pct(level)}` },
                  { tag: 'Newcombe 정확 포함률', label: `좌 ${pct(propCovN.missLeft)} · 우 ${pct(propCovN.missRight)}`, value: pct(propCovN.coverage, 2), tone: 'orange', sub: 'P2: 두 Wilson 구간 결합' },
                  { tag: `예: x₁ = ${ex1}, x₂ = ${ex2}`, label: `Wald · Newcombe ${pct(level)}`, value: `[${f4(propIv.lower)}, ${f4(propIv.upper)}]`, sub: `Newcombe [${f4(propIvN.lower)}, ${f4(propIvN.upper)}]` },
                ]}
              />
              <DesignCurveChart
                domain={[0.02, 0.98]}
                series={[
                  { label: 'Wald', color: 'var(--c-cover)', f: (p) => propDiffCoverage(p, n1, s.pp2, n2, level).coverage },
                  { label: 'Newcombe', color: 'var(--c-miss)', dash: '6 3', f: (p) => propDiffCoverage(p, n1, s.pp2, n2, level, 'newcombe').coverage },
                ]}
                marks={[{ x: s.pp1, label: `p₁ = ${s.pp1}: Wald ${pct(propCov.coverage, 1)}`, color: 'var(--c-truth)' }]}
                xTitle={`p₁ (p₂ = ${s.pp2} 고정)`}
                yTitle="정확 포함률"
                xTickCount={5}
                yFormat={(v) => `${Math.round(v * 100)}%`}
                ariaLabel={`p₁에 따른 정확 포함률, Wald와 Newcombe, p₂ = ${s.pp2}`}
                height={220}
              />
              <p className="chart-caption">실선 Wald, 점선 Newcombe(hybrid score). 모든 (x₁, x₂) 조합의 이중 전수 합입니다. Wald는 작은 n이나 0·1에 가까운 비율에서 명목수준을 밑돌고, 각 비율의 Wilson 구간을 결합한 Newcombe 구간은 명목수준 근처를 더 고르게 지킵니다.</p>
            </>
          )}

          <ExportBar s={s} update={update} experimentId="E11" svgRef={svgRef} />
          {present && de !== 'prop' && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>Space</kbd> 100회
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.4.1–8.4.3 · 8.6.2 · p.310–322</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>설계가 구간을 정한다</h2>
          <ExplainTabs
            intuition={
              <>
                <p>독립 두 표본에서는 두 표본평균의 불확실성이 더해집니다. 등분산을 가정할 수 있으면 두 분산을 합쳐(pooled) 추정하고, 아니면 따로 씁니다(Welch).</p>
                <p>대응 표본은 같은 대상을 두 번 잰 것이라 쌍별 차이 하나만 분석합니다. 쌍 사이의 개인차가 빠지므로 양의 상관이 클수록 구간이 좁아집니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`\text{pooled: } (\bar x_1-\bar x_2) \pm t_{n_1+n_2-2}\, S_p\sqrt{\tfrac1{n_1}+\tfrac1{n_2}}`}</Tex>
                <Tex block>{String.raw`\text{Welch: } (\bar x_1-\bar x_2) \pm t_{\nu}\sqrt{\tfrac{S_1^2}{n_1}+\tfrac{S_2^2}{n_2}},\ \ \nu = \frac{(S_1^2/n_1+S_2^2/n_2)^2}{\frac{(S_1^2/n_1)^2}{n_1-1}+\frac{(S_2^2/n_2)^2}{n_2-1}}`}</Tex>
                <Tex block>{String.raw`\text{대응: } \bar d \pm t_{n-1}\frac{S_d}{\sqrt n}`}</Tex>
                <Tex block>{String.raw`\text{두 비율: } (\hat p_1-\hat p_2) \pm z\sqrt{\tfrac{\hat p_1(1-\hat p_1)}{n_1}+\tfrac{\hat p_2(1-\hat p_2)}{n_2}}`}</Tex>
              </>
            }
            proof={
              <>
                <p>독립이면 Var(X̄₁ − X̄₂) = σ₁²/n₁ + σ₂²/n₂입니다. pooled t는 σ₁ = σ₂일 때만 정확한 t 분포를 따르고, 아니면 S_p²의 기댓값이 (n₁−1)σ₁² + (n₂−1)σ₂²를 자유도로 나눈 값이 되어 큰 표본 쪽 분산에 가중됩니다.</p>
                <p>대응이면 Var(D̄) = (σ₁² + σ₂² − 2ρσ₁σ₂)/n이고, D가 정규이면 (D̄ − δ)/(S_d/√n) ~ t(n − 1)입니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
