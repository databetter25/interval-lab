// E01 반복표집 실험실 — 고정된 참값과 움직이는 구간 (PRD v2 §7 E01)
import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { randomSeed } from '../engine/core/rng'
import { criticalValue, standardError, type Alt, type Method } from '../engine/meanInterval'
import { blockCounts, coverage, mcSe, missSide, replicateData, replicateInterval, type RepMethod } from '../engine/repeat'
import { BlockHist } from '../components/chart/BlockHist'
import { FunnelChart } from '../components/chart/FunnelChart'
import { IntervalStack, type StackItem } from '../components/chart/IntervalStack'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Fold, Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { replicatesCsv, rCode } from '../lib/exports'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useReplicates } from '../lib/useReplicates'
import { LIMITS, serializeState, type LabState, type Update } from '../state/labState'

const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')

const E01_PRESETS: { id: string; label: string; desc: string; patch: Partial<LabState> }[] = [
  { id: 'base', label: '기본', desc: 'N(100, 25²), n = 25, z, 95%', patch: { mu: 100, sigma: 25, n: 25, method: 'z', level: 0.95, alt: 'two', k: 0, B: 1000, sel: -1 } },
  { id: 'textbook', label: '교재 재현', desc: '[프로그램 8.1]: N(0, 1), n = 10, t, 100회', patch: { mu: 0, sigma: 1, n: 10, method: 't', level: 0.95, alt: 'two', k: 0, B: 100, sel: -1 } },
  { id: 'small-t', label: '작은 표본 t', desc: 'N(100, 25²), n = 5, t', patch: { mu: 100, sigma: 25, n: 5, method: 't', level: 0.95, alt: 'two', k: 0, B: 1000, sel: -1 } },
]

const ALT_OPTIONS: { value: Alt; label: string }[] = [
  { value: 'two', label: '양측' },
  { value: 'greater', label: '하한만' },
  { value: 'less', label: '상한만' },
]

export function E01({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const gen = { mu: s.mu, sigma: s.sigma, n: s.n, seed: s.seed }
  const reps = useReplicates(gen, s.seed >= 0 ? s.k : 0)
  const count = reps.count
  const rm: RepMethod = { method: s.method, level: s.level, alt: s.alt, sigma: s.sigma, n: s.n }
  const se = standardError(s.sigma, s.n)
  const domain: [number, number] = [s.mu - 4.5 * se, s.mu + 4.5 * se]

  const { xbar: repX, s: repS } = reps
  const { method, level, alt, sigma, n, mu } = s
  const stats = useMemo(() => coverage({ method, level, alt, sigma, n }, { xbar: repX, s: repS }, mu, count), [repX, repS, count, method, level, alt, sigma, n, mu])
  const shownFrom = Math.max(0, count - s.show)
  const items: StackItem[] = []
  for (let b = shownFrom; b < count; b++) {
    const iv = replicateInterval(rm, reps.xbar[b], reps.s[b])
    items.push({ b, lower: iv.lower, upper: iv.upper, side: missSide(iv, s.mu) })
  }
  const blocks = useMemo(() => blockCounts(stats.covers, count), [stats, count])

  const draw = (m: number) => update((cur) => ({ k: Math.min(LIMITS.k[1], cur.k + m), seed: cur.seed < 0 ? randomSeed() : cur.seed }))
  const toB = () => update((cur) => ({ k: Math.max(cur.k, cur.B), seed: cur.seed < 0 ? randomSeed() : cur.seed }))
  const stop = () => update({ k: reps.cancel() })
  const reset = () => update({ k: 0, sel: -1 })
  const resetNewSeed = () => update({ k: 0, sel: -1, seed: randomSeed() })

  useShortcuts({ Space: () => draw(1), t: () => draw(10), h: () => update((cur) => ({ hide: !cur.hide })), r: reset }, present)

  const covRate = count ? stats.covered / count : NaN
  const err = mcSe(stats.covered, count)
  const sel = s.sel >= 0 && s.sel < count ? s.sel : -1
  const selIv = sel >= 0 ? replicateInterval(rm, reps.xbar[sel], reps.s[sel]) : null
  const selData = sel >= 0 ? replicateData(gen, sel) : null
  const q = criticalValue(s.method, s.level, s.n, s.alt)
  const qLabel = s.alt === 'two' ? 'Q_{1-\\alpha/2}' : 'Q_{1-\\alpha}'
  const dist = s.method === 'z' ? 'N(0,1)' : `t_{${s.n - 1}}`

  const last100 = Math.min(100, count)
  const last100Covered = count >= 100 ? stats.cumulative[count - 1] - (count > 100 ? stats.cumulative[count - 101] : 0) : 0

  return (
    <>
      <Predict
        experimentId="E01"
        itemId="E01-P1"
        question={`${Math.round(s.level * 1000) / 10}% 구간을 100번 만들면, 참값을 포함하는 구간은 몇 개일까요?`}
        choices={[
          { text: `언제나 정확히 ${Math.round(s.level * 100)}개`, misconception: 'M2', feedback: '포함 개수는 매번 달라집니다. 100개 중 포함 개수는 Binomial(100, 1−α)을 따릅니다.' },
          { text: `대체로 ${Math.round(s.level * 100)}개 근처지만, 할 때마다 달라진다`, correct: true, feedback: '신뢰수준은 반복할수록 포함 비율이 다가가는 값입니다(교재 8.1의 정의). 100개라는 유한한 묶음에서는 흔들립니다.' },
          { text: `적어도 ${Math.round(s.level * 100)}개는 보장된다`, misconception: 'M6', feedback: '보장되는 것은 하한이 아니라 평균적인 비율입니다. 아래 묶음 히스토그램에서 그보다 적은 묶음도 보입니다.' },
          { text: '참값을 모르므로 셀 수 없다', misconception: 'M1', feedback: '실제 연구에서는 그렇습니다. 하지만 이 실험은 참값을 정해 두고 자료를 만들었기 때문에 셀 수 있습니다.' },
        ]}
        revealed={count >= 100 && !s.hide}
        waitHint="‘100회’를 누르거나 100개 이상 뽑은 뒤 결과를 확인하세요."
        resultSummary={count >= 100 ? `최근 100개 중 ${last100Covered}개가 참값을 포함했습니다.` : ''}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>설정</h2>
          <div className="field">
            <span className="field-label">프리셋</span>
            <div className="row" style={{ gap: 6 }}>
              {E01_PRESETS.map((p) => (
                <button key={p.id} type="button" className="btn-outline sm" title={p.desc} onClick={() => update({ ...p.patch, seed: s.seed })}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <SliderField label="참값 μ (교육용)" value={s.mu} min={-1000} max={1000} step={1} onChange={(mu) => update({ mu })} />
          <SliderField label="모표준편차 σ" value={s.sigma} min={0.5} max={100} step={0.5} onChange={(sigma) => update({ sigma })} />
          <SliderField label="표본크기 n" value={s.n} min={LIMITS.n[0]} max={200} step={1} onChange={(n) => update({ n })} hint="숫자 칸에는 1000까지 입력할 수 있습니다." />
          <Segmented<Method>
            label="방법"
            value={s.method}
            options={[
              { value: 'z', label: 'z (σ 알려짐)' },
              { value: 't', label: 't (σ를 S로)' },
            ]}
            onChange={(method) => update({ method })}
          />
          <SliderField label="신뢰수준 1−α" value={s.level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(level) => update({ level })} format={(v) => pct(v, 1)} />
          <Segmented<Alt> label="구간 형태" value={s.alt} options={ALT_OPTIONS} onChange={(alt) => update({ alt })} />
          <Fold title="반복·표시·seed">
            <div className="settings">
              <SliderField label="목표 반복 수 B" value={s.B} min={100} max={LIMITS.B[1]} step={100} onChange={(B) => update({ B })} format={fmtInt} />
              <SliderField label="그림에 그릴 구간 수" value={s.show} min={LIMITS.show[0]} max={LIMITS.show[1]} step={10} onChange={(show) => update({ show })} hint="통계는 언제나 뽑은 전체로 계산합니다." />
              <div className="field">
                <span className="field-label">
                  <span>seed</span>
                  <output>{s.seed >= 0 ? s.seed : '처음 뽑을 때 정함'}</output>
                </span>
                <button type="button" className="btn-outline sm" onClick={resetNewSeed}>
                  새 seed로 초기화
                </button>
              </div>
            </div>
          </Fold>
          <AssumptionBadges items={['정규 모집단', '독립 표본', s.method === 'z' ? 'σ 알려짐' : 'σ 미지']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="반복표집 그림">
          <div className="run-bar" role="group" aria-label="표본 뽑기">
            <button type="button" className="btn-filled sm" onClick={() => draw(1)}>
              1회
            </button>
            <button type="button" className="btn-outline sm" onClick={() => draw(10)}>
              10회
            </button>
            <button type="button" className="btn-outline sm" onClick={() => draw(100)}>
              100회
            </button>
            <button type="button" className="btn-outline sm" onClick={() => draw(1000)}>
              1,000회
            </button>
            <button type="button" className="btn-outline sm" onClick={toB} disabled={s.k >= s.B}>
              B = {fmtInt(s.B)}까지
            </button>
            {reps.running ? (
              <>
                <button type="button" className="btn-filled sm danger" onClick={stop}>
                  정지
                </button>
                <div className="prog-track progress-inline" role="progressbar" aria-label="계산 진행률" aria-valuenow={Math.round(reps.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="prog-fill" style={{ width: `${reps.progress * 100}%`, transition: 'none' }} />
                </div>
              </>
            ) : (
              <button type="button" className="btn-ghost" onClick={reset} disabled={count === 0}>
                초기화
              </button>
            )}
            <button type="button" className="btn-outline sm" aria-pressed={s.hide} onClick={() => update({ hide: !s.hide })} style={{ marginLeft: 'auto' }}>
              {s.hide ? '참값 공개' : '참값 숨기기'}
            </button>
          </div>

          <IntervalStack
            svgRef={svgRef}
            items={items}
            rows={s.show}
            truth={s.mu}
            hideTruth={s.hide}
            domain={domain}
            selected={sel}
            onSelect={(b) => update({ sel: b === sel ? -1 : b })}
            ariaLabel={`최근 ${items.length}개 구간. ${s.hide ? '참값은 숨김' : `참값 ${s.mu}을 포함한 구간 ${items.filter((i) => i.side === 'none').length}개`}`}
          />
          <Legend
            items={
              s.hide
                ? [{ color: 'var(--c-neutral)', label: '구간 (참값을 숨겨 포함 여부를 표시하지 않음)', pattern: 'fill' }]
                : [
                    { color: 'var(--c-truth)', label: '참값 μ (고정)', pattern: 'fill' },
                    { color: 'var(--c-cover)', label: '참값을 포함한 구간', pattern: 'fill' },
                    { color: 'var(--c-miss)', label: '포함하지 않은 구간 (오른쪽 ✕)', pattern: 'fill' },
                  ]
            }
          />

          {s.hide ? (
            <p className="hidden-note">참값을 숨긴 상태입니다. 실제 연구처럼, 구간 하나가 참값을 포함했는지는 알 수 없습니다. ‘참값 공개’를 누르면 포함 여부와 포함률이 나타납니다.</p>
          ) : (
            <>
              <StatGrid
                stats={[
                  { tag: '포함', label: `${fmtInt(stats.covered)} / ${fmtInt(count)}`, value: pct(covRate), sub: `명목수준 ${pct(s.level)}` },
                  { tag: 'MC 표준오차', label: '√(ĉ(1−ĉ)/B)', value: count ? `${(err * 100).toFixed(2)}%p` : '—', sub: count ? `±2SE: ${pct(covRate - 2 * err)} ~ ${pct(covRate + 2 * err)}` : '' },
                  { tag: '평균 길이', label: s.method === 't' ? '표본마다 다름' : '모든 구간 같음', value: Number.isFinite(stats.meanWidth) ? fmtNum(stats.meanWidth, 3) : s.alt === 'two' ? '—' : '∞', tone: 'orange' },
                ]}
              />
              <p className="result-line">
                좌측 비포함(L &gt; μ) {fmtInt(stats.missLeft)}개 ({pct(count ? stats.missLeft / count : NaN, 2)}) · 우측 비포함(U &lt; μ) {fmtInt(stats.missRight)}개 ({pct(count ? stats.missRight / count : NaN, 2)}) · 최근 {last100}개 중 {count >= 100 ? last100Covered : '—'}개 포함
              </p>

              <h3 className="chart-title">누적 포함률은 명목수준으로 다가간다</h3>
              <FunnelChart cumulative={stats.cumulative} count={count} level={s.level} ariaLabel={`누적 포함률 ${pct(covRate)}, 반복 ${count}회`} />
              <h3 className="chart-title">100개 묶음의 포함 개수는 흔들린다</h3>
              {blocks.length >= 2 ? (
                <>
                  <BlockHist counts={blocks} level={s.level} ariaLabel={`100개 묶음 ${blocks.length}개의 포함 개수 분포`} />
                  <p className="chart-caption">
                    막대: 묶음 {blocks.length}개의 상대도수 · 점선: Binomial(100, {s.level}) · 가장 적은 묶음 {Math.min(...blocks)}개, 가장 많은 묶음 {Math.max(...blocks)}개
                  </p>
                </>
              ) : (
                <p className="chart-caption">100개 묶음이 2개 이상 모이면(200회 이상) 나타납니다. ‘1,000회’를 눌러 보세요.</p>
              )}
            </>
          )}

          <ExportBar s={s} update={update} experimentId="E01" svgRef={svgRef} csv={() => replicatesCsv(s, reps, count, 'E01')} rCode={() => rCode(s)} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>Space</kbd> 1회 · <kbd>T</kbd> 10회 · <kbd>H</kbd> 참값 숨김/공개 · <kbd>R</kbd> 초기화
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.1 · p.299–302 · 8.8 [프로그램 8.1]</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>움직이는 것은 구간, 참값은 고정</h2>
          <ExplainTabs
            intuition={
              <>
                <p>참값선은 처음부터 끝까지 그 자리에 있습니다. 표본을 새로 뽑을 때마다 움직이는 것은 구간입니다.</p>
                <p>
                  ‘95%’는 <strong>이 방법을 반복하면</strong> 구간의 95%가 참값을 포함한다는, 절차의 성질입니다. 이미 계산한 구간 하나는 참값을 포함하거나 포함하지 않으며, 실제 연구에서는 어느 쪽인지 알 수 없습니다.
                </p>
                <p className="muted">‘참값 숨기기’로 실제 연구의 상황을 체험해 보세요.</p>
              </>
            }
            calc={
              <>
                <p>현재 설정의 임계값과 표준오차:</p>
                <Tex block>{String.raw`${qLabel}(${dist}) = ${q.toFixed(6)}`}</Tex>
                {s.method === 'z' ? <Tex block>{String.raw`\mathrm{SE} = \sigma/\sqrt{n} = ${s.sigma}/\sqrt{${s.n}} = ${se.toFixed(4)}`}</Tex> : <Tex block>{String.raw`\mathrm{SE}_b = S_b/\sqrt{${s.n}}\ \text{(반복마다 다름)}`}</Tex>}
                {sel >= 0 && selIv ? (
                  <Tex block>{String.raw`\#${sel + 1}:\ ${fmtNum(reps.xbar[sel], 3)} \pm ${q.toFixed(4)}\times ${fmtNum((s.method === 'z' ? s.sigma : reps.s[sel]) / Math.sqrt(s.n), 4)}`}</Tex>
                ) : (
                  <p className="muted">그림에서 구간을 누르면 그 구간의 계산이 여기에 나옵니다.</p>
                )}
              </>
            }
            proof={
              <>
                <p>{s.method === 'z' ? '피벗량 Z = (X̄ − μ)/(σ/√n) ~ N(0, 1)에서 출발합니다.' : '피벗량 T = (X̄ − μ)/(S/√n) ~ t(n − 1)에서 출발합니다(정규·독립 표본).'}</p>
                <Tex block>{String.raw`P\!\left(-q \le \frac{\bar X-\mu}{\mathrm{SE}} \le q\right) = 1-\alpha`}</Tex>
                <p>괄호 안을 μ에 대한 부등식으로 바꾸면</p>
                <Tex block>{String.raw`P\!\left(\bar X - q\,\mathrm{SE} \le \mu \le \bar X + q\,\mathrm{SE}\right) = 1-\alpha`}</Tex>
                <p>확률이 붙은 것은 무작위인 X̄(그래서 무작위인 구간)이고 μ는 상수입니다. 교재 식 (8.2)–(8.3)과 같은 변형입니다.</p>
              </>
            }
          />

          <h3 style={{ marginTop: 18 }}>선택한 구간</h3>
          {sel >= 0 && selIv && selData ? (
            <div className="sel-box">
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn-outline sm" disabled={sel <= 0} onClick={() => update({ sel: sel - 1 })} aria-label="이전 구간">
                  ← 이전
                </button>
                <strong>#{sel + 1}</strong>
                <button type="button" className="btn-outline sm" disabled={sel >= count - 1} onClick={() => update({ sel: sel + 1 })} aria-label="다음 구간">
                  다음 →
                </button>
              </div>
              <dl>
                <dt>x̄</dt>
                <dd>{fmtNum(reps.xbar[sel], 4)}</dd>
                <dt>S</dt>
                <dd>{fmtNum(reps.s[sel], 4)}</dd>
                <dt>SE</dt>
                <dd>{fmtNum((s.method === 'z' ? s.sigma : reps.s[sel]) / Math.sqrt(s.n), 4)}</dd>
                <dt>구간</dt>
                <dd>
                  [{fmtNum(selIv.lower, 4)}, {fmtNum(selIv.upper, 4)}]
                </dd>
                <dt>참값 포함</dt>
                <dd>{s.hide ? '숨김' : missSide(selIv, s.mu) === 'none' ? '포함 ○' : '포함하지 않음 ✕'}</dd>
              </dl>
              <Fold title={`원자료 ${s.n}개`}>
                <p className="raw-data">{Array.from(selData, (v) => v.toFixed(3)).join(', ')}</p>
              </Fold>
              <Link to={`/lab/e02?${serializeState({ ...s, stage: 4 }).toString()}`}>신뢰띠에서 이 표본 보기 →</Link>
            </div>
          ) : (
            <p className="muted">그림의 구간을 누르면 x̄, S, 원자료를 볼 수 있습니다.</p>
          )}
          <div className="note blue" style={{ marginTop: 16 }}>
            <strong>생각해 보기</strong> — 1,000번 중 938번만 포함되었다면 구현 오류일까요? MC 표준오차의 몇 배만큼 떨어져 있는지로 판단해 보세요.
          </div>
        </aside>
      </div>
    </>
  )
}

