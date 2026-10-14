// E12 베이즈 심화: 동일꼬리·HPD·사전 민감도 (PRD v2 §7 E12, P1)
import { useMemo, useRef } from 'react'
import { LOG, LOGIT, betaDist, equalTail, gammaDist, hpd, mixtureDist, normalDist, transformed, type Dist1D, type Reparam } from '../engine/bayesSets'
import { posterior } from '../engine/threeViews'
import type { Interval } from '../engine/meanInterval'
import { SetDensityChart } from '../components/chart/SetDensityChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Segmented, SliderField, Tex, TextbookBadge } from '../components/ui'
import { fmtNum } from '../lib/format'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
const ivText = (iv: Interval) => `[${f4(iv.lower)}, ${f4(iv.upper)}]`
const setText = (cs: Interval[]) => cs.map(ivText).join(' ∪ ')

type Family = LabState['bf']

const PRESETS: { label: string; title: string; patch: Partial<LabState> }[] = [
  { label: '교재 예 9.7', title: '이항, 사전 Beta(1, 1), n = 10, x = 3 → Beta(4, 8)', patch: { bf: 'beta', pa: 1, pb: 1, bn: 10, bx: 3, level: 0.95 } },
  { label: '교재 예 9.8', title: 'N(θ, 1), n = 10, 사전 N(0, 10²), x̄ = 10.2', patch: { bf: 'normal', xbar: 10.2, sigma: 1, n: 10, m0: 0, tau0: 10, level: 0.95 } },
  { label: '치우친 Gamma', title: '포아송, 사전 Gamma(1, 0.5), 4회 관측 합 3 → Gamma(4, 4.5)', patch: { bf: 'gamma', ga: 1, gb: 0.5, pn: 4, gs: 3, level: 0.95 } },
  { label: 'U자형 Beta', title: 'Beta(0.4, 0.4): 가운데 밀도가 가장 낮다', patch: { bf: 'betad', pa: 0.4, pb: 0.4, level: 0.95 } },
  { label: '두 봉우리', title: '두 정규의 혼합: 다봉 사후분포', patch: { bf: 'mix', md: 3.3, level: 0.95 } },
]

function posteriorOf(s: LabState): { dist: Dist1D; reparam: Reparam | null; desc: string } {
  switch (s.bf) {
    case 'beta': {
      const a = s.pa + Math.min(s.bx, s.bn)
      const b = s.pb + s.bn - Math.min(s.bx, s.bn)
      return { dist: betaDist(a, b), reparam: LOGIT, desc: `사전 Beta(${s.pa}, ${s.pb}), n = ${s.bn}, x = ${Math.min(s.bx, s.bn)} → 사후 Beta(${fmtNum(a, 2)}, ${fmtNum(b, 2)})` }
    }
    case 'betad':
      return { dist: betaDist(s.pa, s.pb), reparam: LOGIT, desc: `Beta(${s.pa}, ${s.pb})를 사후분포로 직접 지정` }
    case 'gamma': {
      const k = s.ga + s.gs
      const r = s.gb + s.pn
      return { dist: gammaDist(k, r), reparam: LOG, desc: `포아송 율 λ, 사전 Gamma(${s.ga}, ${s.gb}), ${s.pn}회 관측 합 ${s.gs} → 사후 Gamma(${fmtNum(k, 3)}, ${fmtNum(r, 3)})` }
    }
    case 'normal': {
      const p = posterior(s.xbar, s.sigma, s.n, { kind: 'normal', m0: s.m0, tau0: s.tau0 })
      return { dist: normalDist(p.mean, p.variance), reparam: null, desc: `N(θ, ${s.sigma}²), n = ${s.n}, x̄ = ${s.xbar}, 사전 N(${s.m0}, ${s.tau0}²) → 사후 N(${fmtNum(p.mean, 4)}, ${fmtNum(p.variance, 4)})` }
    }
    case 'mix': {
      const k = s.md / 3.3
      return { dist: mixtureDist(0.6, -1.5 * k, 0.6, 1.8 * k, 0.8), reparam: null, desc: `0.6·N(${fmtNum(-1.5 * k, 3)}, 0.36) + 0.4·N(${fmtNum(1.8 * k, 3)}, 0.64)` }
    }
  }
}

export function E12({ s, update }: { s: LabState; update: Update }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { dist, reparam, desc } = posteriorOf(s)
  const level = s.level
  const res = useMemo(() => ({ et: equalTail(dist, level), hp: hpd(dist, level) }), [dist.name, level]) // eslint-disable-line react-hooks/exhaustive-deps
  const { et, hp } = res
  const phi = useMemo(() => {
    if (!s.rp || !reparam) return null
    const d = transformed(dist, reparam)
    const h2 = hpd(d, level)
    return { d, hp: h2, et: equalTail(d, level), back: h2.components.map((c) => ({ lower: reparam.ginv(c.lower), upper: reparam.ginv(c.upper) })) }
  }, [s.rp, dist.name, level, reparam?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const priors =
    s.bf === 'beta'
      ? [
          { a: 1, b: 1, name: '균등 Beta(1, 1)' },
          { a: 0.5, b: 0.5, name: 'Jeffreys Beta(½, ½)' },
          { a: 2, b: 2, name: 'Beta(2, 2)' },
          { a: 10, b: 10, name: '강한 사전 Beta(10, 10)' },
          { a: 2, b: 8, name: '치우친 사전 Beta(2, 8)' },
        ].map((p) => {
          const x = Math.min(s.bx, s.bn)
          const d = betaDist(p.a + x, p.b + s.bn - x)
          return { ...p, mean: (p.a + x) / (p.a + p.b + s.bn), et: equalTail(d, level), hp: hpd(d, level) }
        })
      : []

  const etLen = et.upper - et.lower
  const L = pct(level)
  const xTitle = s.bf === 'gamma' ? 'λ' : s.bf === 'beta' || s.bf === 'betad' ? 'p' : 'θ'

  return (
    <>
      <Predict
        experimentId="E12"
        itemId="E12-P1"
        question={`오른쪽으로 치우친 사후분포에서 ${L} 동일꼬리 구간과 ${L} 최고사후밀도(HPD) 집합은 어떻게 다를까요?`}
        choices={[
          { text: '같은 사후질량이니 같은 구간이다', misconception: 'M9', feedback: '사후질량이 같은 집합은 무수히 많습니다(교재 9.4). 동일꼬리는 양 꼬리 넓이를, HPD는 밀도 높이를 기준으로 고릅니다.' },
          { text: 'HPD가 더 짧고 밀도가 높은(최빈값) 쪽으로 옮겨 간다', correct: true, feedback: 'HPD는 밀도가 높은 곳부터 채우므로 같은 질량에서 가장 짧은 집합입니다. 치우친 분포에서는 최빈값 쪽으로 이동합니다.' },
          { text: '동일꼬리 구간이 더 짧다', misconception: 'M5', feedback: '그 좌표에서 HPD가 길이가 최소인 집합입니다. 동일꼬리는 계산이 쉬운 대신 길이가 같거나 더 깁니다.' },
          { text: 'HPD는 언제나 하나의 구간이다', misconception: 'M9', feedback: 'U자형이나 봉우리가 여럿인 사후분포에서는 HPD가 끊어진 여러 구간이 됩니다. 프리셋으로 확인해 보세요.' },
        ]}
        revealed
        waitHint=""
        resultSummary={`지금 사후분포: 동일꼬리 ${ivText(et)} (길이 ${f4(etLen)}), HPD ${setText(hp.components)} (길이 ${f4(hp.length)}).`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>사후분포</h2>
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
          <Segmented<Family>
            label="종류"
            value={s.bf}
            options={[
              { value: 'beta', label: '이항 + Beta 사전' },
              { value: 'betad', label: 'Beta 직접' },
              { value: 'gamma', label: '포아송 + Gamma' },
              { value: 'normal', label: '정규 + 정규 사전' },
              { value: 'mix', label: '다봉 (혼합)' },
            ]}
            onChange={(v) => update({ bf: v })}
          />
          {(s.bf === 'beta' || s.bf === 'betad') && (
            <>
              <SliderField label={s.bf === 'beta' ? '사전 a' : 'a'} value={s.pa} min={0.1} max={20} step={0.1} onChange={(v) => update({ pa: v })} />
              <SliderField label={s.bf === 'beta' ? '사전 b' : 'b'} value={s.pb} min={0.1} max={20} step={0.1} onChange={(v) => update({ pb: v })} />
            </>
          )}
          {s.bf === 'beta' && (
            <>
              <SliderField label="시행 수 n" value={s.bn} min={LIMITS.bn[0]} max={LIMITS.bn[1]} step={1} onChange={(v) => update((c) => ({ bn: v, bx: Math.min(c.bx, v) }))} />
              <SliderField label="성공 수 x" value={Math.min(s.bx, s.bn)} min={0} max={s.bn} step={1} onChange={(v) => update({ bx: v })} />
            </>
          )}
          {s.bf === 'gamma' && (
            <>
              <SliderField label="사전 shape" value={s.ga} min={0.1} max={20} step={0.1} onChange={(v) => update({ ga: v })} />
              <SliderField label="사전 rate" value={s.gb} min={0.1} max={20} step={0.1} onChange={(v) => update({ gb: v })} />
              <SliderField label="관측 수" value={s.pn} min={0} max={100} step={1} onChange={(v) => update({ pn: v })} />
              <SliderField label="관측값의 합" value={s.gs} min={0} max={200} step={1} onChange={(v) => update({ gs: v })} />
            </>
          )}
          {s.bf === 'normal' && (
            <>
              <SliderField label="x̄" value={s.xbar} min={-1000} max={1000} step={0.1} onChange={(v) => update({ xbar: v })} />
              <SliderField label="σ (알려짐)" value={s.sigma} min={0.1} max={100} step={0.1} onChange={(v) => update({ sigma: v })} />
              <SliderField label="n" value={s.n} min={2} max={200} step={1} onChange={(v) => update({ n: v })} />
              <SliderField label="사전평균 m₀" value={s.m0} min={-1000} max={1000} step={0.5} onChange={(v) => update({ m0: v })} />
              <SliderField label="사전표준편차 τ₀" value={s.tau0} min={0.1} max={200} step={0.1} onChange={(v) => update({ tau0: v })} />
            </>
          )}
          {s.bf === 'mix' && <SliderField label="봉우리 간격" value={s.md} min={0} max={6} step={0.1} onChange={(v) => update({ md: v })} hint="간격이 좁으면 HPD가 한 구간으로 이어집니다." />}
          <SliderField label="사후질량 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          {reparam && (
            <label className="row" style={{ gap: 8, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={s.rp} onChange={(e) => update({ rp: e.target.checked })} />
              {reparam.name} 좌표에서도 보기
            </label>
          )}
          <AssumptionBadges items={s.bf === 'mix' ? ['다봉 사후분포의 예 (혼합)'] : ['켤레 사전분포', '사후분포는 닫힌 형태']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="동일꼬리와 HPD">
          <p className="chart-caption" style={{ marginTop: 0 }}>{desc}</p>
          <SetDensityChart
            svgRef={svgRef}
            dist={dist}
            components={hp.components}
            h={hp.h}
            brackets={[
              { iv: et, label: `동일꼬리 ${ivText(et)}`, color: 'var(--c-cover)' },
              ...(phi ? phi.back.map((iv) => ({ iv, label: `${reparam!.name.split(' ')[0]} HPD를 되돌림 ${ivText(iv)}`, color: 'var(--c-miss)', dash: '5 3' })) : []),
            ]}
            xTitle={xTitle}
            ariaLabel={`${dist.name}의 ${L} HPD ${setText(hp.components)}와 동일꼬리 ${ivText(et)}`}
          />
          <div className="table-scroll" tabIndex={0} role="region" aria-label="동일꼬리와 HPD 비교 표">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col">집합</th>
                  <th scope="col">끝점</th>
                  <th scope="col">길이</th>
                  <th scope="col">사후질량</th>
                  <th scope="col">경계의 밀도</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">동일꼬리</th>
                  <td className="num">{ivText(et)}</td>
                  <td className="num">{f4(etLen)}</td>
                  <td className="num">{(dist.cdf(et.upper) - dist.cdf(et.lower)).toFixed(6)}</td>
                  <td className="num">
                    {dist.pdf(et.lower).toPrecision(4)} · {dist.pdf(et.upper).toPrecision(4)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">HPD {hp.components.length > 1 ? `(${hp.components.length}조각)` : ''}</th>
                  <td className="num">{setText(hp.components)}</td>
                  <td className="num target-hit">{f4(hp.length)}</td>
                  <td className="num">{hp.mass.toFixed(6)}</td>
                  <td className="num">h = {hp.h.toPrecision(6)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="chart-caption">
            {hp.components.length > 1
              ? `HPD가 끊어진 ${hp.components.length}개의 구간으로 나뉩니다. 구간 하나로 억지로 묶지 않습니다(교재 9.4의 단점).`
              : Math.abs(etLen - hp.length) < 1e-6 * etLen
                ? '대칭 단봉 분포라 HPD와 동일꼬리가 같습니다(교재 예 9.8).'
                : `같은 사후질량에서 HPD가 ${f4(etLen - hp.length)} 짧습니다. 동일꼬리의 두 끝은 밀도가 다르고, HPD의 끝은 같은 높이 h에 있습니다.`}
          </p>

          {phi && reparam && (
            <>
              <h3 className="chart-title">{reparam.name} 좌표: HPD는 그대로 옮겨 가지 않는다</h3>
              <SetDensityChart dist={phi.d} components={phi.hp.components} h={phi.hp.h} brackets={[{ iv: phi.et, label: `동일꼬리 ${ivText(phi.et)}`, color: 'var(--c-cover)' }]} xTitle={`φ = ${reparam.name}`} ariaLabel={`φ 좌표의 HPD ${setText(phi.hp.components)}`} height={220} />
              <div className="table-scroll" tabIndex={0} role="region" aria-label="재매개화 비교 표">
                <table className="data-table compare-table">
                  <thead>
                    <tr>
                      <th scope="col">θ 좌표로 나타낸 집합</th>
                      <th scope="col">끝점</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">θ 좌표의 HPD</th>
                      <td className="num">{setText(hp.components)}</td>
                    </tr>
                    <tr>
                      <th scope="row">φ 좌표의 HPD를 θ로 되돌림</th>
                      <td className="num under">{setText(phi.back)}</td>
                    </tr>
                    <tr>
                      <th scope="row">φ 좌표의 동일꼬리를 θ로 되돌림</th>
                      <td className="num">
                        {ivText({ lower: reparam.ginv(phi.et.lower), upper: reparam.ginv(phi.et.upper) })} = θ 좌표의 동일꼬리
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="chart-caption">HPD의 ‘가장 짧다’는 성질은 그 좌표에서만 성립합니다. 밀도에 야코비안 |dθ/dφ|가 곱해져 높이 순서가 바뀌기 때문입니다. 동일꼬리 구간은 분위수로 정해져 단조변환을 그대로 따라갑니다.</p>
            </>
          )}

          {priors.length > 0 && (
            <>
              <h3 className="chart-title">사전 민감도: 같은 자료 (n = {s.bn}, x = {Math.min(s.bx, s.bn)}), 다른 사전분포</h3>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="사전 민감도 표">
                <table className="data-table compare-table">
                  <thead>
                    <tr>
                      <th scope="col">사전분포</th>
                      <th scope="col">사후평균</th>
                      <th scope="col">동일꼬리</th>
                      <th scope="col">HPD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priors.map((p) => (
                      <tr key={p.name}>
                        <th scope="row">{p.name}</th>
                        <td className="num">{f4(p.mean)}</td>
                        <td className="num">{ivText(p.et)}</td>
                        <td className="num">{setText(p.hp.components)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="chart-caption">자료가 적을수록 사전분포에 따라 신용구간이 크게 움직입니다. 사후질량 {L}는 어느 행에서나 같지만, 고정된 p에서의 포함률은 행마다 다릅니다(E06·E07).</p>
            </>
          )}
          <ExportBar s={s} update={update} experimentId="E12" svgRef={svgRef} />
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 9.4 정의 9.1–9.3 · 예 9.7·9.8 · 9.5 · p.344–358</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>같은 사후질량, 다른 집합</h2>
          <ExplainTabs
            intuition={
              <>
                <p>사후질량이 {L}인 집합은 무수히 많습니다. 동일꼬리는 양 끝에서 넓이를 똑같이 잘라 내고, HPD는 밀도가 가장 높은 곳부터 채웁니다.</p>
                <p>그래서 HPD 안의 어느 점도 밖의 어느 점보다 밀도가 높고, 같은 질량에서 길이가 가장 짧습니다. 대신 계산이 어렵고, 봉우리가 여럿이면 여러 조각으로 나뉩니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`\text{동일꼬리: } [Q_{\alpha/2},\ Q_{1-\alpha/2}]\ \text{of } \pi(\theta\mid x)`}</Tex>
                <Tex block>{String.raw`\text{HPD: } \{\theta : \pi(\theta\mid x) \ge h\},\ \ P(\cdot) = 1-\alpha`}</Tex>
                <p>
                  h = {hp.h.toPrecision(6)}, 조각 {hp.components.length}개, 길이 {f4(hp.length)}
                </p>
              </>
            }
            proof={
              <>
                <p>정의 9.2: C가 HPD이면 모든 θ ∈ C, θ′ ∉ C에서 π(θ|x) ≥ π(θ′|x). 같은 질량의 다른 집합 D와 비교하면 C∖D의 밀도가 D∖C의 밀도 이상이고 두 부분의 질량이 같으므로 |C∖D| ≤ |D∖C|, 곧 C가 더 짧습니다.</p>
                <p>φ = g(θ)로 바꾸면 밀도는 π(g⁻¹(φ)|x)·|dg⁻¹/dφ|가 되어 비교 대상인 높이가 달라집니다. 분위수는 단조변환으로 그대로 옮겨 가므로 동일꼬리 구간은 좌표에 무관합니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
