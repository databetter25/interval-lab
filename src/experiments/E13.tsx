// E13 CDF 역산과 비유일성 (PRD v2 §7 E13, P1): Uniform(0, θ)의 최댓값
import { useMemo, useRef } from 'react'
import { randomSeed } from '../engine/core/rng'
import { aFor, bMin, cdfAt, cdfInversion, centralB, maxReplicates, shortestB, uniformInterval } from '../engine/cdfInversion'
import { mcSe } from '../engine/repeat'
import { DesignCurveChart } from '../components/chart/DesignCurveChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => (Number.isFinite(v) ? fmtNum(v, 4) : '∞')
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')

let simCache: { key: string; ms: Float64Array } | null = null
function useMaxima(seed: number, n: number, theta: number, k: number): Float64Array {
  const key = `${seed}|${n}|${theta}`
  if (!simCache || simCache.key !== key) simCache = { key, ms: new Float64Array(0) }
  if (seed >= 0 && simCache.ms.length < k) {
    const more = maxReplicates(seed, simCache.ms.length, k, n, theta)
    const all = new Float64Array(k)
    all.set(simCache.ms)
    all.set(more, simCache.ms.length)
    simCache.ms = all
  }
  return seed >= 0 ? simCache.ms.subarray(0, k) : new Float64Array(0)
}

export function E13({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const n = s.un
  const M = s.mo
  const level = s.level
  const alpha = 1 - level
  const lo = bMin(n, level)
  const bc = centralB(n, level)
  const b = s.bs < 0 ? bc : Math.min(1, Math.max(lo + 1e-9, s.bs))
  const a = aFor(b, n, level)
  const iv = uniformInterval(M, n, level, b)
  const central = uniformInterval(M, n, level, bc)
  const oneSided = uniformInterval(M, n, level, 1)
  const best = useMemo(() => shortestB(n, level, M), [n, level, M])
  const inv = cdfInversion(M, n, alpha / 2, alpha / 2)

  const ms = useMaxima(s.seed, n, s.th, s.k)
  const cov = useMemo(() => {
    const out = { cur: 0, cen: 0, one: 0, lenCur: 0, lenCen: 0 }
    for (const m of ms) {
      const c1 = uniformInterval(m, n, level, b)
      const c2 = uniformInterval(m, n, level, bc)
      const c3 = uniformInterval(m, n, level, 1)
      if (c1.lower <= s.th && s.th <= c1.upper) out.cur++
      if (c2.lower <= s.th && s.th <= c2.upper) out.cen++
      if (c3.lower <= s.th && s.th <= c3.upper) out.one++
      out.lenCur += c1.upper - c1.lower
      out.lenCen += c2.upper - c2.lower
    }
    return out
  }, [ms, n, level, b, bc, s.th])
  const count = ms.length

  const draw = (k: number) => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + k), seed: c.seed < 0 ? randomSeed() : c.seed }))
  useShortcuts({ Space: () => draw(100) }, present)

  return (
    <>
      <Predict
        experimentId="E13"
        itemId="E13-P1"
        question={`Uniform(0, θ)에서 n = ${n}개를 뽑아 최댓값 M = ${M}을 얻었습니다. 포함률이 똑같이 ${pct(level)}인 중앙 구간과 한쪽 구간 [M, M/α^(1/n)] 중 어느 쪽이 짧을까요?`}
        choices={[
          { text: '중앙(등꼬리) 구간', misconception: 'M9', feedback: '등꼬리가 최단인 것은 피벗 분포가 대칭 단봉일 때입니다. U = M/θ의 밀도 n·u^(n−1)은 u = 1 쪽으로 몰려 있습니다.' },
          { text: '한쪽 구간 [M, M/α^(1/n)]', correct: true, feedback: `피벗의 밀도가 가장 높은 u = 1을 포함하도록 b = 1로 잡으면 가장 짧습니다. 중앙 ${f4(central.upper - central.lower)} 대 한쪽 ${f4(oneSided.upper - oneSided.lower)}.` },
          { text: '포함률이 같으니 길이도 같다', misconception: 'M9', feedback: '포함률이 같은 구간은 무수히 많고, 그 길이는 서로 다릅니다.' },
          { text: '어느 쪽이 맞는지는 철학의 문제다', misconception: 'M11', feedback: '두 구간은 같은 피벗, 같은 포함률에서 나옵니다. 달라진 것은 ‘길이’라는 선택 기준입니다.' },
        ]}
        revealed
        waitHint=""
        resultSummary={`중앙 ${f4(central.upper - central.lower)}, 한쪽 ${f4(oneSided.upper - oneSided.lower)}.`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>자료와 구간</h2>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-outline sm" onClick={() => update({ un: 5, mo: 0.9, level: 0.95, bs: -1, th: 1 })}>
              기준 (n=5, M=0.9)
            </button>
          </div>
          <SliderField label="표본크기 n" value={n} min={1} max={100} step={1} onChange={(v) => update({ un: v })} />
          <SliderField label="관측 최댓값 M" value={M} min={0.01} max={10} step={0.01} onChange={(v) => update({ mo: v })} />
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <div className="field">
            <span className="field-label">구간 선택 (b)</span>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn-outline sm" aria-pressed={s.bs < 0} onClick={() => update({ bs: -1 })}>
                중앙
              </button>
              <button type="button" className="btn-outline sm" aria-pressed={s.bs === 1} onClick={() => update({ bs: 1 })}>
                한쪽 (b = 1)
              </button>
              <button type="button" className="btn-outline sm" onClick={() => update({ bs: best })}>
                최단
              </button>
            </div>
          </div>
          <SliderField label="b (U의 상한 분위수)" value={Number(b.toFixed(4))} min={Number((lo + 0.0001).toFixed(4))} max={1} step={0.0001} onChange={(v) => update({ bs: v })} format={(v) => `b = ${v.toFixed(4)}, a = ${aFor(v, n, level).toFixed(4)}`} />
          <h3 style={{ marginTop: 6 }}>반복표집 (교육용 θ)</h3>
          <SliderField label="참값 θ" value={s.th} min={0.1} max={10} step={0.1} onChange={(v) => update({ th: v })} />
          <div className="run-bar" role="group" aria-label="표본 뽑기">
            {[100, 1000].map((k) => (
              <button key={k} type="button" className="btn-outline sm" onClick={() => draw(k)}>
                {k.toLocaleString('ko-KR')}회
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => update({ k: 0 })} disabled={count === 0}>
              초기화
            </button>
          </div>
          <AssumptionBadges items={['Uniform(0, θ)', '독립 표본']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="CDF 역산과 비유일성">
          <StatGrid
            stats={[
              { tag: '지금 구간 [M/b, M/a]', label: `b = ${b.toFixed(4)}`, value: `[${f4(iv.lower)}, ${f4(iv.upper)}]`, sub: `길이 ${f4(iv.upper - iv.lower)}` },
              { tag: '중앙 구간', label: 'a = (α/2)^(1/n), b = (1−α/2)^(1/n)', value: `[${f4(central.lower)}, ${f4(central.upper)}]`, sub: `길이 ${f4(central.upper - central.lower)}` },
              { tag: '한쪽 구간 (최단)', label: 'b = 1, a = α^(1/n)', value: `[${f4(oneSided.lower)}, ${f4(oneSided.upper)}]`, tone: 'orange', sub: `길이 ${f4(oneSided.upper - oneSided.lower)}` },
            ]}
          />
          <h3 className="chart-title">① 피벗 U = M/θ의 밀도 n·u^(n−1): u = 1 쪽으로 몰려 있다</h3>
          <DesignCurveChart
            svgRef={svgRef}
            domain={[0.001, 1]}
            series={[
              { label: '밀도', color: 'var(--c-cover)', f: (u) => n * u ** (n - 1) },
              { label: '[a, b]', color: 'var(--c-miss)', f: (u) => (u >= a && u <= b ? n * u ** (n - 1) : NaN) },
            ]}
            marks={[
              { x: Math.max(0.001, a), label: `a = ${a.toFixed(3)}`, color: 'var(--c-truth)' },
              { x: b, label: `b = ${b.toFixed(3)}`, color: 'var(--c-truth)' },
            ]}
            xTitle="u = M/θ"
            yTitle="밀도"
            xTickCount={5}
            ariaLabel={`피벗 밀도와 구간 [a, b] = [${a.toFixed(4)}, ${b.toFixed(4)}], 넓이 ${pct(level)}`}
            height={210}
          />
          <p className="chart-caption">주황 부분의 넓이 bⁿ − aⁿ = {pct(level)}. 같은 넓이를 밀도가 높은 오른쪽 끝(b = 1)에서 잡을수록 [a, b]가 좁고, 그만큼 θ의 구간 [M/b, M/a]도 짧아집니다.</p>

          <h3 className="chart-title">② b에 따른 θ 구간의 길이 — 최솟값은 b = 1</h3>
          <DesignCurveChart
            domain={[lo + (1 - lo) * 0.01, 1]}
            series={[{ label: '길이', color: 'var(--c-cover)', f: (bb) => uniformInterval(M, n, level, bb).upper - uniformInterval(M, n, level, bb).lower }]}
            marks={[
              { x: b, label: `지금 ${f4(iv.upper - iv.lower)}`, color: 'var(--c-truth)' },
              { x: bc, label: `중앙 ${f4(central.upper - central.lower)}`, color: 'var(--c-mu0)' },
              { x: 1, label: `b = 1: ${f4(oneSided.upper - oneSided.lower)}`, color: 'var(--c-miss)' },
            ]}
            xTitle="b"
            yTitle="구간 길이"
            xTickCount={5}
            ariaLabel={`b에 따른 구간 길이, 최단 b = ${best.toFixed(4)}`}
            height={210}
          />
          <p className="chart-caption">격자 탐색으로 찾은 최단 b = {best.toFixed(4)}. 구간이 달라지는 이유는 ‘철학’이 아니라 ‘무엇을 짧게 할지’라는 기준의 선택입니다.</p>

          <h3 className="chart-title">③ CDF 역산: F(M | θ) = (M/θ)ⁿ을 θ의 함수로 보고 α/2, 1 − α/2에서 자른다</h3>
          <DesignCurveChart
            domain={[M, Math.min(M * 4, inv.upper * 1.4)]}
            series={[
              { label: 'F(M|θ)', color: 'var(--c-pval)', f: (t) => cdfAt(M, t, n) },
              { label: 'α/2', color: 'var(--c-reject)', dash: '5 4', f: () => alpha / 2 },
              { label: '1−α/2', color: 'var(--c-reject)', dash: '5 4', f: () => 1 - alpha / 2 },
            ]}
            marks={[
              { x: inv.lower, label: `θ_L = ${f4(inv.lower)}`, color: 'var(--c-obs)' },
              { x: inv.upper, label: `θ_U = ${f4(inv.upper)}`, color: 'var(--c-obs)' },
            ]}
            xTitle="θ"
            yTitle="F(M | θ)"
            ariaLabel={`CDF 역산으로 얻은 중앙 구간 [${f4(inv.lower)}, ${f4(inv.upper)}]`}
            height={210}
          />
          <p className="chart-caption">F(M|θ)는 θ에 대해 감소합니다. F = 1 − α/2인 θ_L과 F = α/2인 θ_U가 중앙 구간의 끝점이며 ① 피벗 방법과 정확히 같습니다(CB 9.2.3). 이항에서 같은 일을 하면 Clopper–Pearson 구간이 됩니다(E06).</p>

          {count > 0 && (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="포함률 시뮬레이션 표">
              <table className="data-table compare-table">
                <thead>
                  <tr>
                    <th scope="col">구간 (θ = {s.th}, 반복 {fmtInt(count)}회)</th>
                    <th scope="col">포함률</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: `지금 (b = ${b.toFixed(4)})`, k: cov.cur },
                    { name: '중앙', k: cov.cen },
                    { name: '한쪽 (b = 1)', k: cov.one },
                  ].map((r) => (
                    <tr key={r.name}>
                      <th scope="row">{r.name}</th>
                      <td className="num">
                        {pct(r.k / count)} ±{(2 * mcSe(r.k, count) * 100).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ExportBar s={s} update={update} experimentId="E13" svgRef={svgRef} />
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>확장: Casella–Berger 9.2.3 · 9.3.1</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>포함률이 같아도 구간은 하나가 아니다</h2>
          <ExplainTabs
            intuition={
              <>
                <p>M은 θ보다 클 수 없으므로 θ의 하한은 언제나 M 이상입니다. M/θ는 1 가까이에 몰려 있어서, 참값 θ는 대개 M보다 조금만 큽니다.</p>
                <p>그래서 하한을 M에 붙이고 위쪽으로만 여유를 두는 한쪽 구간이 가장 짧습니다. 중앙 구간은 꼬리를 똑같이 나누느라 밀도가 낮은 곳까지 덮습니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`P\!\left(a \le \tfrac{M}{\theta} \le b\right) = b^n - a^n = 1-\alpha \;\Rightarrow\; \theta \in \left[\tfrac{M}{b},\ \tfrac{M}{a}\right]`}</Tex>
                <Tex block>{String.raw`\text{길이} = M\left(\tfrac1a - \tfrac1b\right),\quad a = (b^n - (1-\alpha))^{1/n}`}</Tex>
                <p>
                  n = {n}, M = {M}: 중앙 [{f4(central.lower)}, {f4(central.upper)}], 한쪽 [{f4(oneSided.lower)}, {f4(oneSided.upper)}]
                </p>
              </>
            }
            proof={
              <>
                <p>
                  P(M ≤ m) = (m/θ)ⁿ이므로 U = M/θ의 분포는 θ와 무관한 피벗입니다. b를 키우면 a도 커지고, d/db(1/a − 1/b) = −a′/a² + 1/b²에서 a′ = (b/a)^(n−1)이므로 부호는 1/b² − b^(n−1)/a^(n+1)입니다. a &lt; b이고 n ≥ 1이면 이 값은 음수라서 길이는 b에 대해 감소하고, 최솟값은 b = 1에서 나옵니다.
                </p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
