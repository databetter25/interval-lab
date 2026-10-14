// E03 피벗량으로 구간 만들기 (PRD v2 §7 E03): z·t (P0), χ² 모분산·F 분산비 (P1)
import { useEffect, useMemo, useRef, useState } from 'react'
import { normPpf } from '../engine/core/normal'
import { pivotDist, pivotInterval, shortestShare, splitTails, type PivotKind, type PivotObs } from '../engine/pivot'
import { DesignCurveChart } from '../components/chart/DesignCurveChart'
import { PivotDensityChart } from '../components/chart/PivotDensityChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { LIMITS, type LabState, type Update } from '../state/labState'
import { StageSteps } from './StageSteps'

const fb = (v: number) => (v === Infinity ? '∞' : v === -Infinity ? '−∞' : fmtNum(v, 4))
const tex = (v: number) => (v === Infinity ? '\\infty' : v === -Infinity ? '-\\infty' : fmtNum(v, 4).replace('−', '-'))
const pct = (v: number, d = 2) => `${Math.round(v * 10 ** (d + 2)) / 10 ** d}%`
const FLIP = '#c2410c'

const META: Record<PivotKind, { label: string; target: string; textbook: string; scope: 'P0' | 'P1'; preset: Partial<LabState>; assumptions: string[] }> = {
  z: { label: 'z (σ 알려짐)', target: 'μ', textbook: '교재 8.2.1 · p.303–305', scope: 'P0', preset: { xbar: 100, sigma: 25, n: 25 }, assumptions: ['정규 모집단', '독립 표본', 'σ 알려짐'] },
  t: { label: 't (σ 미지)', target: 'μ', textbook: '교재 8.2.1 · p.305–307', scope: 'P0', preset: { xbar: 100, sd: 20, n: 25 }, assumptions: ['정규 모집단', '독립 표본'] },
  chi2: { label: 'χ² (모분산)', target: 'σ²', textbook: '교재 8.3 · p.308–309', scope: 'P1', preset: { sd: 2, n: 10 }, assumptions: ['정규 모집단 (평균에 대한 t보다 훨씬 민감)', '독립 표본'] },
  f: { label: 'F (분산비)', target: 'σ₁²/σ₂²', textbook: '교재 8.5 · p.316–318', scope: 'P1', preset: { sd: 2, n: 10, sd2: 1.5, n2: 8 }, assumptions: ['두 정규 모집단', '두 표본 서로 독립'] },
}

export function E03({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const kind = s.pv
  const meta = META[kind]
  const alpha = 1 - s.level
  const { aL, aU } = splitTails(alpha, s.ts)
  const o: PivotObs = { xbar: s.xbar, sigma: s.sigma, s: s.sd, n: s.n, s2: s.sd2, n2: s.n2 }
  const dist = pivotDist(kind, o)
  const iv = pivotInterval(kind, o, aL, aU)
  const qL = dist.ppf(aL)
  const qU = dist.ppf(1 - aU)
  const equal = pivotInterval(kind, o, alpha / 2, alpha / 2)
  const best = useMemo(() => shortestShare(kind, o, alpha), [kind, alpha, o.xbar, o.sigma, o.s, o.n, o.s2, o.n2]) // eslint-disable-line react-hooks/exhaustive-deps
  const bestIv = pivotInterval(kind, o, ...(Object.values(splitTails(alpha, best)) as [number, number]))
  const len = iv.upper - iv.lower
  const stage = s.stage

  const firstTs = useRef(s.ts)
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    if (s.ts !== firstTs.current) setMoved(true)
  }, [s.ts])

  useShortcuts({ ArrowRight: () => update((c) => ({ stage: Math.min(4, c.stage + 1) })), ArrowLeft: () => update((c) => ({ stage: Math.max(1, c.stage - 1) })) }, present)

  const pivotTex = kind === 'z' ? String.raw`Z = \frac{\bar X - \mu}{\sigma/\sqrt n}` : kind === 't' ? String.raw`T = \frac{\bar X - \mu}{S/\sqrt n}` : kind === 'chi2' ? String.raw`W = \frac{(n-1)S^2}{\sigma^2}` : String.raw`F = \frac{S_1^2/\sigma_1^2}{S_2^2/\sigma_2^2} = \frac{S_1^2/S_2^2}{\rho}`
  const symbol = kind === 'z' ? 'Z' : kind === 't' ? 'T' : kind === 'chi2' ? 'W' : 'F'
  const theta = kind === 'chi2' ? '\\sigma^2' : kind === 'f' ? '\\rho' : '\\mu'
  const flip = (t: string) => String.raw`\textcolor{${FLIP}}{${t}}`

  const steps3: { tex: string; note?: string }[] =
    kind === 'z' || kind === 't'
      ? [
          { tex: String.raw`Q_{\alpha_L} \le \frac{\bar X-\mu}{\mathrm{SE}} \le Q_{1-\alpha_U}` },
          { tex: String.raw`Q_{\alpha_L}\,\mathrm{SE} \le \bar X-\mu \le Q_{1-\alpha_U}\,\mathrm{SE}`, note: 'SE > 0을 곱함: 방향 그대로' },
          { tex: String.raw`-Q_{1-\alpha_U}\,\mathrm{SE} ${flip('\\le')} \mu-\bar X ${flip('\\le')} -Q_{\alpha_L}\,\mathrm{SE}`, note: '−1을 곱함: 부등호 방향이 바뀌고 양 끝이 자리를 바꾼다' },
          { tex: String.raw`\bar X - Q_{1-\alpha_U}\,\mathrm{SE} \le \mu \le \bar X - Q_{\alpha_L}\,\mathrm{SE}` },
        ]
      : kind === 'chi2'
        ? [
            { tex: String.raw`Q_{\alpha_L} \le \frac{(n-1)S^2}{\sigma^2} \le Q_{1-\alpha_U}` },
            { tex: String.raw`\frac{1}{Q_{1-\alpha_U}} ${flip('\\le')} \frac{\sigma^2}{(n-1)S^2} ${flip('\\le')} \frac{1}{Q_{\alpha_L}}`, note: '역수를 취함: 부등호 방향이 바뀌고 양 끝이 자리를 바꾼다' },
            { tex: String.raw`\frac{(n-1)S^2}{Q_{1-\alpha_U}} \le \sigma^2 \le \frac{(n-1)S^2}{Q_{\alpha_L}}` },
          ]
        : [
            { tex: String.raw`Q_{\alpha_L} \le \frac{S_1^2/S_2^2}{\rho} \le Q_{1-\alpha_U}` },
            { tex: String.raw`\frac{1}{Q_{1-\alpha_U}} ${flip('\\le')} \frac{\rho}{S_1^2/S_2^2} ${flip('\\le')} \frac{1}{Q_{\alpha_L}}`, note: '역수를 취함: 부등호 방향이 바뀐다' },
            { tex: String.raw`\frac{S_1^2/S_2^2}{Q_{1-\alpha_U}} \le \rho \le \frac{S_1^2/S_2^2}{Q_{\alpha_L}}` },
          ]

  const plug =
    kind === 'z' || kind === 't'
      ? String.raw`${o.xbar} - (${tex(qU)})(${fmtNum((kind === 'z' ? o.sigma : o.s) / Math.sqrt(o.n), 4)}) \le \mu \le ${o.xbar} - (${tex(qL)})(${fmtNum((kind === 'z' ? o.sigma : o.s) / Math.sqrt(o.n), 4)})`
      : kind === 'chi2'
        ? String.raw`\frac{${o.n - 1}\times ${fmtNum(o.s * o.s, 4)}}{${tex(qU)}} \le \sigma^2 \le \frac{${o.n - 1}\times ${fmtNum(o.s * o.s, 4)}}{${tex(qL)}}`
        : String.raw`\frac{${fmtNum((o.s * o.s) / (o.s2 * o.s2), 4)}}{${tex(qU)}} \le \rho \le \frac{${fmtNum((o.s * o.s) / (o.s2 * o.s2), 4)}}{${tex(qL)}}`

  const shapes = [
    { label: '등꼬리', share: 0.5 },
    { label: '1% / 4%', share: 0.2 },
    { label: '4% / 1%', share: 0.8 },
    { label: '한쪽 (하한만)', share: 0 },
    { label: '한쪽 (상한만)', share: 1 },
  ]

  return (
    <>
      <Predict
        experimentId="E03"
        itemId="E03-P1"
        question={`같은 ${pct(s.level, 1)}인데 피벗의 꼬리를 ${pct(alpha / 2, 1)}/${pct(alpha / 2, 1)}이 아니라 다르게(예: 1%/4%) 나누면 구간은 어떻게 될까요?`}
        choices={[
          { text: '똑같은 구간이 나온다', misconception: 'M9', feedback: '꼬리 배분이 다르면 쓰는 분위수가 달라져서 구간의 위치와 길이가 바뀝니다. 같은 수준에서도 구간은 하나로 정해지지 않습니다.' },
          { text: '포함률은 그대로지만 구간의 위치가 옮겨지고, 대칭 분포에서는 길어진다', correct: true, feedback: 'P(Q_{α_L} ≤ 피벗 ≤ Q_{1−α_U}) = 1 − α는 어떤 배분에서도 성립하므로 포함률은 같습니다. 대칭 단봉 분포에서는 등꼬리가 가장 짧고, 비대칭 분포(χ², F)에서는 등꼬리가 최단이 아닙니다.' },
          { text: '포함률이 95%보다 낮아진다', misconception: 'M6', feedback: '두 꼬리의 합이 α이면 포함률은 정확히 1 − α입니다. 바뀌는 것은 좌우 비포함 확률의 배분입니다.' },
          { text: '구간이 더 좁아진다', misconception: 'M5', feedback: '대칭 단봉 분포에서는 등꼬리가 가장 짧으므로, 다르게 나누면 오히려 길어집니다.' },
        ]}
        revealed={moved}
        waitHint="꼬리 배분 슬라이더나 ‘1% / 4%’ 버튼으로 바꿔 보세요."
        resultSummary={`지금 구간 [${fb(iv.lower)}, ${fb(iv.upper)}], 등꼬리 구간 [${fb(equal.lower)}, ${fb(equal.upper)}].`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>피벗과 꼬리</h2>
          <Segmented<PivotKind>
            label="피벗량"
            value={kind}
            options={(['z', 't', 'chi2', 'f'] as const).map((k) => ({ value: k, label: META[k].label }))}
            onChange={(pv) => update({ pv, ...META[pv].preset, ts: 0.5 })}
          />
          {meta.scope === 'P1' && <p className="field-hint">교재 범위의 확장 실험(P1): 비대칭 분위수와 역수 변형</p>}
          <SliderField label="신뢰수준 1−α" value={s.level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v, 1)} />
          <div className="field">
            <span className="field-label">꼬리 모양</span>
            <div className="row" style={{ gap: 6 }}>
              {shapes.map((sh) => (
                <button key={sh.label} type="button" className="btn-outline sm" aria-pressed={Math.abs(s.ts - sh.share) < 1e-9} onClick={() => update({ ts: sh.share })}>
                  {sh.label}
                </button>
              ))}
              <button type="button" className="btn-outline sm" aria-pressed={Math.abs(s.ts - best) < 1e-6} onClick={() => update({ ts: Number(best.toFixed(6)) })}>
                최단
              </button>
            </div>
          </div>
          <SliderField label="꼬리 배분 α_L / α" value={s.ts} min={0} max={1} step={0.01} onChange={(v) => update({ ts: v })} format={(v) => `α_L ${pct(alpha * v)} · α_U ${pct(alpha * (1 - v))}`} />
          <h3 style={{ marginTop: 6 }}>관측 요약</h3>
          {(kind === 'z' || kind === 't') && <SliderField label="x̄" value={s.xbar} min={-1000} max={1000} step={0.1} onChange={(v) => update({ xbar: v })} />}
          {kind === 'z' && <SliderField label="σ (알려짐)" value={s.sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />}
          {kind !== 'z' && <SliderField label={kind === 'f' ? 'S₁' : 'S'} value={s.sd} min={0.1} max={100} step={0.1} onChange={(v) => update({ sd: v })} />}
          <SliderField label={kind === 'f' ? 'n₁' : 'n'} value={s.n} min={2} max={200} step={1} onChange={(v) => update({ n: v })} />
          {kind === 'f' && (
            <>
              <SliderField label="S₂" value={s.sd2} min={0.1} max={100} step={0.1} onChange={(v) => update({ sd2: v })} />
              <SliderField label="n₂" value={s.n2} min={2} max={200} step={1} onChange={(v) => update({ n2: v })} />
            </>
          )}
          <AssumptionBadges items={meta.assumptions} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="피벗에서 구간으로">
          <StageSteps stage={stage} onStage={(v) => update({ stage: v })} labels={['피벗의 분포', '확률 문장', '부등식 변형', '자료 대입']} />
          <h3 className="chart-title" style={{ marginTop: 0 }}>
            ① 피벗 {symbol} ~ {dist.name}: 모수와 무관한 분포
          </h3>
          <Tex block>{pivotTex}</Tex>
          <PivotDensityChart svgRef={svgRef} dist={dist} aL={aL} aU={aU} xTitle={`${symbol}의 값`} ariaLabel={`${dist.name} 분포, 왼쪽 꼬리 ${pct(aL)}, 오른쪽 꼬리 ${pct(aU)}`} />

          {stage >= 2 && (
            <div className="pivot-step">
              <h3 className="chart-title">② 확률 문장 (관측 전, 무작위인 것은 {symbol})</h3>
              <Tex block>{String.raw`P\left(Q_{\alpha_L} \le ${symbol} \le Q_{1-\alpha_U}\right) = 1 - \alpha_L - \alpha_U = ${fmtNum(1 - alpha, 4)}`}</Tex>
              <Tex block>{String.raw`Q_{${fmtNum(aL, 4)}} = ${tex(qL)},\qquad Q_{${fmtNum(1 - aU, 4)}} = ${tex(qU)}`}</Tex>
              {dist.symmetric && s.ts !== 0.5 && <p className="field-hint">대칭 분포라 Q_(α_L) = −Q_(1−α_L)입니다. 등꼬리가 아니면 두 분위수의 절댓값이 다릅니다.</p>}
            </div>
          )}
          {stage >= 3 && (
            <div className="pivot-step">
              <h3 className="chart-title">③ {meta.target}에 대한 부등식으로 변형</h3>
              {steps3.map((st, i) => (
                <div key={i} className="pivot-line">
                  <Tex block>{(i ? '\\iff ' : '') + st.tex}</Tex>
                  {st.note && <span className={`pivot-note${st.note.includes('바뀌') ? ' flip' : ''}`}>{st.note}</span>}
                </div>
              ))}
            </div>
          )}
          {stage >= 4 && (
            <div className="pivot-step">
              <h3 className="chart-title">④ 자료 대입</h3>
              <Tex block>{plug}</Tex>
              <Tex block>{String.raw`${theta} \in [${tex(iv.lower)},\ ${tex(iv.upper)}]`}</Tex>
            </div>
          )}

          <StatGrid
            stats={[
              { tag: `${meta.target}의 ${pct(s.level, 1)} 구간`, label: s.ts === 0.5 ? '등꼬리' : `α_L ${pct(aL)} / α_U ${pct(aU)}`, value: `[${fb(iv.lower)}, ${fb(iv.upper)}]` },
              { tag: '길이', label: '등꼬리 대비', value: Number.isFinite(len) ? fmtNum(len, 4) : '∞', sub: Number.isFinite(len) ? `× ${fmtNum(len / (equal.upper - equal.lower), 4)}` : '한쪽 구간', tone: 'orange' },
              { tag: '포함률 (이론)', label: '모든 배분에서', value: pct(1 - alpha, 2), sub: `P(L > θ) = α_U ${pct(aU)} · P(U < θ) = α_L ${pct(aL)}` },
            ]}
          />

          <h3 className="chart-title">꼬리 배분과 구간 길이 — {dist.symmetric ? '대칭 단봉 분포라 등꼬리가 가장 짧다' : '비대칭 분포라 등꼬리가 최단이 아니다'}</h3>
          <DesignCurveChart
            domain={[0.02, 0.98]}
            series={[
              {
                label: '길이',
                color: 'var(--c-cover)',
                f: (sh) => {
                  const t = splitTails(alpha, sh)
                  const r = pivotInterval(kind, o, t.aL, t.aU)
                  return r.upper - r.lower
                },
              },
            ]}
            marks={[
              ...(s.ts >= 0.02 && s.ts <= 0.98 ? [{ x: s.ts, label: `지금 ${fmtNum(len, 3)}`, color: 'var(--c-truth)' }] : []),
              { x: 0.5, label: `등꼬리 ${fmtNum(equal.upper - equal.lower, 3)}`, color: 'var(--c-mu0)' },
              ...(Math.abs(best - 0.5) > 0.01 ? [{ x: best, label: `최단 ${fmtNum(bestIv.upper - bestIv.lower, 3)}`, color: 'var(--c-miss)' }] : []),
            ]}
            xTitle="꼬리 배분 α_L / α (양끝 = 한쪽 구간, 길이 ∞)"
            yTitle="구간 길이"
            xFormat={(v) => `${Math.round(v * 100)}%`}
            xTickCount={5}
            ariaLabel={`꼬리 배분에 따른 길이. 최단은 α_L/α = ${fmtNum(best, 3)}에서 ${fmtNum(bestIv.upper - bestIv.lower, 4)}, 등꼬리 ${fmtNum(equal.upper - equal.lower, 4)}`}
            height={220}
          />
          <p className="chart-caption">
            최단 배분 α_L/α = {fmtNum(best, 4)}: [{fb(bestIv.lower)}, {fb(bestIv.upper)}].{' '}
            {dist.symmetric
              ? '대칭 단봉 분포에서는 정확히 등꼬리(50%)입니다.'
              : `${meta.target}의 길이를 기준으로 한 최단 구간이며, 기준을 바꾸면(예: σ의 길이, 로그 척도) 최단 배분도 달라집니다. 교재는 계산이 쉬운 등꼬리 구간을 씁니다.`}
          </p>
          <ExportBar s={s} update={update} experimentId="E03" svgRef={svgRef} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> 단계
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>{meta.textbook}</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>피벗: 분포가 모수에 의존하지 않는 양</h2>
          <ExplainTabs
            intuition={
              <>
                <p>피벗량은 자료와 모수를 함께 담고 있지만, 그 분포는 모수를 몰라도 완전히 알려진 양입니다. 그래서 피벗에 대한 확률 문장을 먼저 쓰고, 그것을 모수에 대한 부등식으로 풀면 구간이 됩니다.</p>
                <p>확률이 붙는 것은 관측 전의 무작위 양(피벗)입니다. ④에서 자료를 대입하면 구간은 숫자가 되고, 그 숫자 구간에는 더 이상 확률이 붙지 않습니다(E01).</p>
                <p className="muted">꼬리를 어떻게 나누든 포함률은 같습니다. 바뀌는 것은 좌우로 놓치는 확률과 길이입니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`\alpha_L = ${fmtNum(aL, 4)},\quad \alpha_U = ${fmtNum(aU, 4)}`}</Tex>
                <Tex block>{String.raw`Q_{\alpha_L}(${dist.name.replace('χ²', '\\chi^2')}) = ${tex(qL)},\quad Q_{1-\alpha_U} = ${tex(qU)}`}</Tex>
                <Tex block>{String.raw`${theta} \in [${tex(iv.lower)},\ ${tex(iv.upper)}]`}</Tex>
              </>
            }
            proof={
              <>
                <p>
                  피벗 Q(X, θ)의 분포가 θ와 무관하면, 모든 θ에서 P_θ(Q_(α_L) ≤ Q(X, θ) ≤ Q_(1−α_U)) = 1 − α입니다. Q가 θ에 대해 단조이면 괄호 안의 사건을 θ에 대한 구간 사건으로 바꿀 수 있고, 같은 사건이므로 확률도 같습니다(Casella–Berger 9.2.2).
                </p>
                <p>
                  <strong>표기 대응표</strong> — 교재는 상측 임계값 z_(α/2)(오른쪽 넓이 α/2)를, 이 사이트는 하측 누적확률 Q_q를 씁니다.
                </p>
                <div className="table-scroll" tabIndex={0} role="region" aria-label="표기 대응표">
                  <table className="data-table compare-table">
                    <thead>
                      <tr>
                        <th scope="col">α</th>
                        <th scope="col">교재 z_(α/2)</th>
                        <th scope="col">사이트 Q_(1−α/2)</th>
                        <th scope="col">값</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0.1, 0.05, 0.01].map((a) => (
                        <tr key={a}>
                          <th scope="row">{a}</th>
                          <td>z_{a / 2}</td>
                          <td>Q_{1 - a / 2}</td>
                          <td className="num">{normPpf(1 - a / 2).toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">χ²에서도 교재의 χ²_(α/2)(상측)는 Q_(1−α/2)(하측)와 같습니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
