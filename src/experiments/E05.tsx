// E05 설계 변수: 신뢰수준·표본크기·표준편차 (PRD v2 §7 E05)
// '계산 비교' 탭은 관측 요약만 쓰고 표본을 전혀 뽑지 않는다 (AC-E05-3). '반복실험 비교' 탭만 새 자료를 만든다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { randomSeed } from '../engine/core/rng'
import { expectedTLength, marginOfError, sampleSizeFor, sampleSizeT, zLength } from '../engine/design'
import { criticalValue } from '../engine/meanInterval'
import { coverage, mcSe, missSide, replicateInterval } from '../engine/repeat'
import { DesignCurveChart } from '../components/chart/DesignCurveChart'
import { IntervalStack, type StackItem } from '../components/chart/IntervalStack'
import { NormalAreaChart } from '../components/chart/NormalAreaChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { replicatesCsv } from '../lib/exports'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useReplicates } from '../lib/useReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const ROWS = 40

export function E05({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const [tab, setTab] = useState<'calc' | 'sim'>('calc')
  const [logAxes, setLogAxes] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)
  const { sigma, n, level } = s
  const q = criticalValue('z', level, n, 'two')
  const E = marginOfError(sigma, n, level)
  const ratio2 = marginOfError(sigma, 2 * n, level) / E
  const ratio4 = marginOfError(sigma, 4 * n, level) / E
  const n99 = Math.ceil(n * (criticalValue('z', 0.99, n, 'two') / q) ** 2)
  const nz = sampleSizeFor(sigma, s.me, level)
  const nt = sampleSizeT(sigma, s.me, level)

  // n을 한 번이라도 바꾸면 예상의 답을 공개한다
  const firstN = useRef(n)
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    if (n !== firstN.current) setMoved(true)
  }, [n])

  // ---- 반복실험 비교: 설계 A (n, 수준)와 B (nb, lb), 같은 σ·μ ----
  const genA = { mu: s.mu, sigma, n, seed: s.seed }
  const genB = { mu: s.mu, sigma, n: s.nb, seed: s.seed }
  const kk = tab === 'sim' && s.seed >= 0 ? s.k : 0
  const A = useReplicates(genA, kk)
  const B = useReplicates(genB, kk)
  const mu = s.mu
  const statsA = useMemo(() => coverage({ method: 'z', level, alt: 'two', sigma, n }, { xbar: A.xbar, s: A.s }, mu, A.count), [A.xbar, A.s, A.count, level, sigma, n, mu])
  const statsB = useMemo(() => coverage({ method: 'z', level: s.lb, alt: 'two', sigma, n: s.nb }, { xbar: B.xbar, s: B.s }, mu, B.count), [B.xbar, B.s, B.count, s.lb, sigma, s.nb, mu])
  const stack = (rep: typeof A, nn: number, lv: number): StackItem[] => {
    const out: StackItem[] = []
    for (let b = Math.max(0, rep.count - ROWS); b < rep.count; b++) {
      const iv = replicateInterval({ method: 'z', level: lv, alt: 'two', sigma, n: nn }, rep.xbar[b], rep.s[b])
      out.push({ b, lower: iv.lower, upper: iv.upper, side: missSide(iv, mu) })
    }
    return out
  }
  const seMax = sigma / Math.sqrt(Math.min(n, s.nb))
  const simDomain: [number, number] = [mu - 4.2 * seMax, mu + 4.2 * seMax]
  const draw = (m: number) => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + m), seed: c.seed < 0 ? randomSeed() : c.seed }))
  useShortcuts({ Space: () => tab === 'sim' && draw(10), ArrowRight: () => update((c) => ({ n: Math.min(LIMITS.n[1], c.n * 2) })), ArrowLeft: () => update((c) => ({ n: Math.max(2, Math.round(c.n / 2)) })) }, present)

  const L = `${Math.round(level * 1000) / 10}%`
  const nDomain: [number, number] = [2, Math.max(400, 8 * n)]

  return (
    <>
      <Predict
        experimentId="E05"
        itemId="E05-P1"
        question={`σ = ${sigma}, ${L} z 구간에서 n을 ${n}에서 ${2 * n}로 2배 늘리면 오차한계는 어떻게 될까요?`}
        choices={[
          { text: '절반이 된다', misconception: 'M7', feedback: '오차한계는 1/√n에 비례합니다. 절반으로 줄이려면 n을 4배로 늘려야 합니다.' },
          { text: '약 0.71배(1/√2)가 된다', correct: true, feedback: 'E = q·σ/√n이므로 n이 2배면 E는 1/√2 ≈ 0.707배입니다. 절반이 되려면 4배가 필요합니다.' },
          { text: '1/4이 된다', misconception: 'M7', feedback: '분산 σ²/n이 1/2배가 되는 것과 오차한계(표준오차에 비례)를 혼동한 것입니다.' },
          { text: '변하지 않는다', feedback: '표준오차 σ/√n이 줄어들므로 오차한계도 줄어듭니다.' },
        ]}
        revealed={moved}
        waitHint="n을 바꿔(예: ‘n × 2’) 오차한계를 확인하세요."
        resultSummary={`E(${2 * n}) / E(${n}) = ${f4(ratio2)}, E(${4 * n}) / E(${n}) = ${f4(ratio4)}.`}
      />

      <div className="tab-nav design-tabs" role="tablist" aria-label="비교 방식">
        <button type="button" role="tab" id="tab-calc" aria-selected={tab === 'calc'} aria-controls="panel-calc" className={`tab-btn${tab === 'calc' ? ' active' : ''}`} onClick={() => setTab('calc')}>
          계산 비교 (자료 고정)
        </button>
        <button type="button" role="tab" id="tab-sim" aria-selected={tab === 'sim'} aria-controls="panel-sim" className={`tab-btn${tab === 'sim' ? ' active' : ''}`} onClick={() => setTab('sim')}>
          반복실험 비교 (새 자료)
        </button>
      </div>

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>설계 변수</h2>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-outline sm" onClick={() => update({ sigma: 25, n: 25, level: 0.95, me: 5 })}>
              기준 (σ=25, n=25, 95%)
            </button>
          </div>
          <SliderField label="모표준편차 σ (알려짐)" value={sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
          <SliderField label="표본크기 n" value={n} min={LIMITS.n[0]} max={LIMITS.n[1]} step={1} onChange={(v) => update({ n: v })} />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-outline sm" onClick={() => update((c) => ({ n: Math.max(2, Math.round(c.n / 2)) }))}>
              n ÷ 2
            </button>
            <button type="button" className="btn-outline sm" onClick={() => update((c) => ({ n: Math.min(LIMITS.n[1], c.n * 2) }))}>
              n × 2
            </button>
            <button type="button" className="btn-outline sm" onClick={() => update((c) => ({ n: Math.min(LIMITS.n[1], c.n * 4) }))}>
              n × 4
            </button>
          </div>
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          {tab === 'calc' ? (
            <SliderField label="목표 오차한계 E (표본크기 설계)" value={s.me} min={0.1} max={50} step={0.1} onChange={(v) => update({ me: v })} />
          ) : (
            <>
              <h3 style={{ marginTop: 8 }}>비교 설계 B</h3>
              <SliderField label="B의 표본크기" value={s.nb} min={LIMITS.nb[0]} max={LIMITS.nb[1]} step={1} onChange={(v) => update({ nb: v })} />
              <SliderField label="B의 신뢰수준" value={s.lb} min={LIMITS.lb[0]} max={LIMITS.lb[1]} step={0.001} onChange={(v) => update({ lb: v })} format={(v) => pct(v)} />
              <SliderField label="참값 μ (교육용)" value={s.mu} min={-1000} max={1000} step={1} onChange={(v) => update({ mu: v })} />
            </>
          )}
          <AssumptionBadges items={['정규 모집단', '독립 표본', 'σ 알려짐 (z)']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="설계 비교">
          {tab === 'calc' ? (
            <div role="tabpanel" id="panel-calc" aria-labelledby="tab-calc">
              <StatGrid
                stats={[
                  { tag: '오차한계 E', label: `q·σ/√n = ${f4(q)}·${sigma}/√${n}`, value: f4(E) },
                  { tag: '구간 길이', label: '2E', value: f4(2 * E) },
                  { tag: 'n을 4배로', label: `E(${4 * n})`, value: f4(E * ratio4), tone: 'orange', sub: `× ${f4(ratio4)}` },
                ]}
              />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                <h3 className="chart-title" style={{ margin: 0 }}>
                  n–E 곡선: n을 4배로 늘려야 E가 절반
                </h3>
                <label className="row" style={{ gap: 6, fontSize: '0.84rem' }}>
                  <input type="checkbox" checked={logAxes} onChange={(e) => setLogAxes(e.target.checked)} />
                  로그–로그 축
                </label>
              </div>
              <DesignCurveChart
                svgRef={svgRef}
                domain={nDomain}
                series={[{ label: 'E(n)', color: 'var(--c-cover)', f: (v) => marginOfError(sigma, v, level) }]}
                marks={[
                  { x: n, label: `n = ${n}: E = ${fmtNum(E, 3)}`, color: 'var(--c-truth)' },
                  { x: 2 * n, label: `2n: × ${fmtNum(ratio2, 3)}`, color: 'var(--c-mu0)' },
                  { x: 4 * n, label: `4n: × ${fmtNum(ratio4, 3)}`, color: 'var(--c-miss)' },
                ]}
                xLog={logAxes}
                yLog={logAxes}
                xTitle="표본크기 n"
                yTitle="오차한계 E"
                ariaLabel={`오차한계 곡선. n = ${n}에서 E = ${f4(E)}, 2n에서 ${f4(E * ratio2)}, 4n에서 ${f4(E * ratio4)}`}
              />
              <p className="chart-caption">{logAxes ? '로그–로그 축에서 E ∝ n^(−1/2)는 기울기 −1/2인 직선입니다. ' : ''}n을 2배로 하면 E는 1/√2 ≈ 0.707배, 4배로 해야 절반이 됩니다.</p>

              <h3 className="chart-title">신뢰수준–길이: 수준을 높이면 꼬리가 얇아지고 구간이 넓어진다</h3>
              <div className="design-pair">
                <DesignCurveChart
                  domain={[0.5, 0.999]}
                  series={[{ label: '길이', color: 'var(--c-cover)', f: (lv) => zLength(sigma, n, lv) }]}
                  marks={[
                    { x: level, label: `${L}: ${fmtNum(2 * E, 2)}`, color: 'var(--c-truth)' },
                    ...(level < 0.99 ? [{ x: 0.99, label: `99%: ${fmtNum(zLength(sigma, n, 0.99), 2)}`, color: 'var(--c-miss)' }] : []),
                  ]}
                  xTitle="신뢰수준 1−α"
                  yTitle="구간 길이 2E"
                  xFormat={(v) => `${Math.round(v * 100)}%`}
                  xTickCount={4}
                  ariaLabel={`신뢰수준에 따른 구간 길이, ${L}에서 ${f4(2 * E)}`}
                  height={220}
                />
                <NormalAreaChart mean={0} sd={1} lo={-q} hi={q} domain={[-4, 4]} xTitle={`Z — 양 꼬리 각 ${pct((1 - level) / 2, 2)}`} color="var(--c-cover)" fill="var(--c-cover-fill)" areaLabel={L} marks={[{ at: q, label: `q = ${fmtNum(q, 3)}`, color: 'var(--c-truth)' }]} ariaLabel={`표준정규분포의 가운데 ${L}, 임계값 ${f4(q)}`} height={220} />
              </div>
              <div className="note" style={{ marginTop: 8 }}>
                높은 신뢰수준과 좁은 구간을 공짜로 함께 얻을 수는 없습니다. 같은 n에서 수준을 99%로 올리면 길이가 {f4(zLength(sigma, n, 0.99) / (2 * E))}배가 됩니다. 길이를 지금대로 두고 99%를 얻으려면 n을 약 {fmtInt(n99)}으로 늘려야 합니다.
              </div>

              <h3 className="chart-title">표본크기 설계: 목표 오차한계 E = {s.me}</h3>
              <StatGrid
                stats={[
                  { tag: 'σ를 아는 z 구간', label: `⌈(q·σ/E)²⌉ = ⌈${fmtNum(((q * sigma) / s.me) ** 2, 2)}⌉`, value: `n = ${fmtInt(nz)}` },
                  { tag: 'σ를 모르는 t 구간', label: '기대 반폭 ≤ E (계획값 σ 사용)', value: `n = ${fmtInt(nt)}`, tone: 'orange', sub: nt > nz ? `z보다 ${fmtInt(nt - nz)}명 더` : '' },
                ]}
              />
              <p className="field-hint">
                <span className="badge badge-yellow">조건</span> n = ⌈(Q₁₋α/₂·σ/E)²⌉은 σ를 아는 양측 z 구간에서만 쓸 수 있습니다. σ를 모르면 t 분위수가 더 크고 S도 흔들려서 같은 E를 얻으려면 n이 더 필요합니다(t 칸은 기대 반폭 기준이며, 개별 구간의 반폭이 E 이하라는 보장은 아닙니다).
              </p>
              <DesignCurveChart
                domain={[2, Math.max(60, 3 * n)]}
                series={[
                  { label: 'z', color: 'var(--c-cover)', f: (v) => zLength(sigma, v, level) },
                  { label: 't', color: 'var(--c-miss)', dash: '6 3', f: (v) => expectedTLength(sigma, v, level) },
                ]}
                marks={[{ x: n, label: `n = ${n}: z ${fmtNum(2 * E, 2)} · t ${fmtNum(expectedTLength(sigma, n, level), 2)}`, color: 'var(--c-truth)' }]}
                xLog
                integerX
                xTitle="표본크기 n (로그 눈금)"
                yTitle="(기대) 구간 길이"
                ariaLabel={`z 구간 길이와 t 구간 기대 길이. n = ${n}에서 z ${f4(2 * E)}, t ${f4(expectedTLength(sigma, n, level))}`}
                height={220}
              />
              <p className="chart-caption">실선: z 구간 길이 2qσ/√n · 점선: t 구간의 기대 길이 2·t·E[S]/√n. 작은 n에서 차이가 크고, n이 커지면 같아집니다.</p>
            </div>
          ) : (
            <div role="tabpanel" id="panel-sim" aria-labelledby="tab-sim">
              <div className="run-bar" role="group" aria-label="새 자료 뽑기">
                {[10, 100, 1000].map((m) => (
                  <button key={m} type="button" className={m === 10 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => draw(m)}>
                    {m.toLocaleString('ko-KR')}회
                  </button>
                ))}
                <button type="button" className="btn-ghost" onClick={() => update({ k: 0, sel: -1 })} disabled={A.count === 0}>
                  초기화
                </button>
                {(A.running || B.running) && <span className="kbd-help">계산 중…</span>}
              </div>
              <div className="design-pair">
                {[
                  { name: 'A', nn: n, lv: level, rep: A, st: statsA },
                  { name: 'B', nn: s.nb, lv: s.lb, rep: B, st: statsB },
                ].map((d) => (
                  <div key={d.name}>
                    <h3 className="chart-title">
                      설계 {d.name}: n = {d.nn}, {pct(d.lv)}
                    </h3>
                    <IntervalStack svgRef={d.name === 'A' ? svgRef : undefined} items={stack(d.rep, d.nn, d.lv)} rows={ROWS} truth={mu} hideTruth={false} domain={simDomain} selected={-1} onSelect={() => undefined} ariaLabel={`설계 ${d.name}의 최근 구간들, 참값 μ = ${mu}`} />
                    <StatGrid
                      stats={[
                        { tag: '포함률', label: `${fmtInt(d.st.covered)} / ${fmtInt(d.rep.count)}`, value: pct(d.rep.count ? d.st.covered / d.rep.count : NaN), sub: d.rep.count ? `±${(2 * mcSe(d.st.covered, d.rep.count) * 100).toFixed(2)}%p` : '' },
                        { tag: '구간 길이', label: '모두 같음 (σ 알려짐)', value: fmtNum(zLength(sigma, d.nn, d.lv), 3), tone: 'orange' },
                      ]}
                    />
                  </div>
                ))}
              </div>
              <p className="chart-caption">
                두 설계 모두 포함률은 각자의 명목수준 근처입니다. 바뀌는 것은 길이입니다: B/A = {f4(zLength(sigma, s.nb, s.lb) / zLength(sigma, n, level))}. 같은 seed를 써도 n이 다르면 다른 표본입니다(반복 {fmtInt(A.count)}회).
              </p>
              <ExportBar s={s} update={update} experimentId="E05" svgRef={svgRef} csv={A.count ? () => replicatesCsv({ ...s, method: 'z', alt: 'two' }, A, A.count, 'E05-A') : undefined} />
            </div>
          )}
          {tab === 'calc' && <ExportBar s={s} update={update} experimentId="E05" svgRef={svgRef} />}
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> n ÷ 2 · <kbd>→</kbd> n × 2 · <kbd>Space</kbd> 반복실험 10회
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.2.1 · p.303–307</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>길이를 정하는 세 손잡이</h2>
          <ExplainTabs
            intuition={
              <>
                <p>구간 길이는 세 가지로 정해집니다. 신뢰수준(임계값 q), 모집단의 흩어짐 σ, 표본크기 n. σ는 연구자가 고를 수 없으므로 실제로 돌릴 수 있는 손잡이는 수준과 n입니다.</p>
                <p>수준을 높이면 꼬리 면적이 줄어 q가 커지고 구간이 넓어집니다. 수준을 지키면서 구간을 좁히는 길은 n을 늘리는 것뿐인데, 길이는 1/√n으로만 줄어듭니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`E = Q_{1-\alpha/2}\,\frac{\sigma}{\sqrt n} = ${f4(q)}\times\frac{${sigma}}{\sqrt{${n}}} = ${f4(E)}`}</Tex>
                <Tex block>{String.raw`n = \left\lceil \left(\frac{Q_{1-\alpha/2}\,\sigma}{E}\right)^2 \right\rceil = ${fmtInt(nz)}`}</Tex>
                <Tex block>{String.raw`\frac{E(kn)}{E(n)} = \frac{1}{\sqrt k}`}</Tex>
              </>
            }
            proof={
              <>
                <p>σ를 알면 구간 길이 2qσ/√n은 확률변수가 아닙니다. 그래서 길이 조건 E를 정확히 만족하는 n을 미리 구할 수 있습니다.</p>
                <p>σ를 모르면 길이 2·t·S/√n이 표본마다 다릅니다. 정규 표본에서 E[S] = c₄(n)σ이고 c₄(n) = √(2/(n−1))·Γ(n/2)/Γ((n−1)/2) &lt; 1이지만, t 분위수가 z보다 커서 기대 길이는 언제나 z 구간보다 깁니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
