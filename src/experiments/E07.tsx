// E07 같은 구간, 세 관점 — 네이만·피셔·베이즈 (PRD v2 §7 E07)
import { useMemo, useRef, useState } from 'react'
import { randomSeed } from '../engine/core/rng'
import { meanInterval, standardError } from '../engine/meanInterval'
import { coverage, mcSe, missSide, replicateInterval } from '../engine/repeat'
import { centralInterval, credibleInterval, drawFrom, fiducial, posterior, shrinkWeight, type Prior } from '../engine/threeViews'
import { CoverageMuChart } from '../components/chart/CoverageMuChart'
import { DrawHist } from '../components/chart/DrawHist'
import { IntervalStack, type StackItem } from '../components/chart/IntervalStack'
import { NormalAreaChart } from '../components/chart/NormalAreaChart'
import { ExportBar, Predict } from '../components/lab'
import { Fold, Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { replicatesCsv } from '../lib/exports'
import { fmtInt, fmtNum } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { useReplicates } from '../lib/useReplicates'
import { LIMITS, type LabState, type Update } from '../state/labState'
import { SENTENCES } from '../content/sentences'

const f4 = (v: number) => fmtNum(v, 4)
/** 수식용 짧은 숫자: 100.0000 → 100, 4.2361 그대로 */
const g = (v: number) => String(Number(v.toFixed(4)))
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const ROWS = 50

export function E07({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const postRef = useRef<SVGSVGElement>(null)
  const [postK, setPostK] = useState(0)
  const [source, setSource] = useState<'bayes' | 'fid'>('bayes')
  const { xbar, sigma, n, level } = s
  const se = standardError(sigma, n)
  const L = `${Math.round(level * 1000) / 10}%`
  const prior: Prior = s.prior === 'normal' ? { kind: 'normal', m0: s.m0, tau0: s.tau0 } : { kind: 'flat' }
  const ci = meanInterval('z', xbar, sigma, n, level)
  const post = posterior(xbar, sigma, n, prior)
  const cb = centralInterval(post, level)
  const fid = fiducial(xbar, sigma, n)
  const cf = centralInterval(fid, level)
  const flat = prior.kind === 'flat'
  const pmass = (dl: number) => pct(level, dl)

  // 세 패널과 표집 그림이 함께 쓰는 μ 축
  const spread = Math.max(4.5 * se, flat ? 0 : Math.abs(post.mean - xbar) + 4.5 * Math.sqrt(post.variance))
  const domain: [number, number] = [xbar - spread, xbar + spread]

  // (a) 반복표집: E01과 같은 엔진·같은 스트림
  const gen = { mu: s.mu, sigma, n, seed: s.seed }
  const reps = useReplicates(gen, s.seed >= 0 ? s.k : 0)
  const count = reps.count
  const rm = { method: 'z' as const, level, alt: 'two' as const, sigma, n }
  const { xbar: repX, s: repS } = reps
  const mu = s.mu
  const stats = useMemo(() => coverage({ method: 'z', level, alt: 'two', sigma, n }, { xbar: repX, s: repS }, mu, count), [repX, repS, count, level, sigma, n, mu])
  const credCovered = useMemo(() => {
    let k = 0
    for (let b = 0; b < count; b++) {
      const iv = credibleInterval(repX[b], sigma, n, level, prior)
      if (iv.lower <= mu && mu <= iv.upper) k++
    }
    return k
  }, [repX, count, sigma, n, level, mu, prior.kind, s.m0, s.tau0]) // eslint-disable-line react-hooks/exhaustive-deps
  const items: StackItem[] = []
  for (let b = Math.max(0, count - ROWS); b < count; b++) {
    const iv = replicateInterval(rm, repX[b], repS[b])
    items.push({ b, lower: iv.lower, upper: iv.upper, side: missSide(iv, mu) })
  }
  const stackDomain: [number, number] = [mu - 4.5 * se, mu + 4.5 * se]

  // (b) 사후표집: 관측 자료 고정
  const drawDist = source === 'bayes' ? post : fid
  const drawIv = source === 'bayes' ? cb : cf
  const draws = useMemo(() => (s.seed >= 0 ? drawFrom(drawDist, s.seed, 0, postK) : new Float64Array(0)), [drawDist.mean, drawDist.variance, s.seed, postK]) // eslint-disable-line react-hooks/exhaustive-deps
  const inside = draws.reduce((a, v) => a + (drawIv.lower <= v && v <= drawIv.upper ? 1 : 0), 0)

  const ensureSeed = () => s.seed < 0 && update({ seed: randomSeed() })
  const drawRep = (m: number) => update((c) => ({ k: Math.min(LIMITS.k[1], c.k + m), seed: c.seed < 0 ? randomSeed() : c.seed }))
  const drawPost = (m: number) => {
    ensureSeed()
    setPostK((v) => Math.min(100_000, v + m))
  }
  useShortcuts({ Space: () => drawRep(1), p: () => drawPost(100) }, present)

  const w = shrinkWeight(sigma, n, prior)

  return (
    <>
      <Predict
        experimentId="E07"
        itemId="E07-P1"
        question={`x̄ = ${xbar}, σ = ${sigma}, n = ${n}에서 구간은 [${f4(ci.lower)}, ${f4(ci.upper)}]입니다. 네이만·베이즈·피듀셜이 말하는 ‘${L}’는 같은 뜻일까요?`}
        choices={[
          { text: `셋 다 ‘μ가 이 구간 안에 있을 확률이 ${L}’라는 뜻이다`, misconception: 'M1', feedback: '네이만의 95%는 관측 전 무작위 구간의 성질입니다. 관측된 구간에 μ가 있을 확률이라는 해석은 베이즈의 사후질량에만 (그것도 사전분포를 정했을 때만) 해당합니다.' },
          { text: '끝점은 같지만, 확률이 붙는 대상이 서로 다르다', correct: true, feedback: '네이만은 반복표집에서 구간이 고정된 μ를 포함하는 비율, 베이즈는 사전·자료 아래 μ의 사후질량, 피듀셜은 사전 없이 뒤집어 만든 μ*의 분포입니다. 두 애니메이션에서 무엇이 움직이는지 비교해 보세요.' },
          { text: '세 관점은 끝점부터 서로 다르다', misconception: 'M11', feedback: '이 단순 모형(정규, σ 알려짐, 평탄 사전)에서는 세 끝점이 정확히 같습니다. 사전분포를 바꾸면 그때 베이즈 구간만 움직입니다.' },
          { text: '베이즈만 옳고 나머지 둘은 잘못된 해석이다', misconception: 'M11', feedback: '세 관점은 서로 다른 질문에 답합니다. 각자의 조건 아래에서 정확한 문장을 쓰는 것이 핵심입니다.' },
        ]}
        revealed={count > 0 && postK > 0}
        waitHint="아래의 반복표집과 사후표집을 각각 한 번 이상 실행해 보세요."
        resultSummary={`반복표집에서는 구간이 움직이고 μ = ${mu}는 고정, 사후표집에서는 x̄ = ${xbar}가 고정되고 μ 쪽 값이 뽑혔습니다.`}
      />

      <section className="panel settings-row" aria-label="고정 자료와 사전분포">
        <div className="settings-cols">
          <div className="settings">
            <h2>고정 자료 (σ 알려짐)</h2>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn-outline sm" onClick={() => update({ xbar: 100, sigma: 25, n: 25, level: 0.95, prior: 'flat' })}>
                기준 프리셋 (n=25, x̄=100, σ=25)
              </button>
            </div>
            <SliderField label="관측 x̄" value={xbar} min={-1000} max={1000} step={0.1} onChange={(v) => update({ xbar: v })} />
            <SliderField label="모표준편차 σ" value={sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
            <SliderField label="표본크기 n" value={n} min={LIMITS.n[0]} max={200} step={1} onChange={(v) => update({ n: v })} />
            <SliderField label="수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          </div>
          <div className="settings">
            <h2>베이즈의 사전분포</h2>
            <Segmented<LabState['prior']>
              label="사전분포"
              value={s.prior}
              options={[
                { value: 'flat', label: '평탄 π(μ) ∝ 1' },
                { value: 'normal', label: '정규 N(m₀, τ₀²)' },
              ]}
              onChange={(v) => update({ prior: v })}
            />
            {s.prior === 'normal' && (
              <>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn-outline sm" onClick={() => update({ m0: 90, tau0: 10 })}>
                    N(90, 10²)
                  </button>
                  <button type="button" className="btn-outline sm" onClick={() => update({ m0: 90, tau0: 2 })}>
                    강한 사전 N(90, 2²)
                  </button>
                </div>
                <SliderField label="사전평균 m₀" value={s.m0} min={-1000} max={1000} step={0.5} onChange={(v) => update({ m0: v })} />
                <SliderField label="사전표준편차 τ₀" value={s.tau0} min={0.5} max={200} step={0.5} onChange={(v) => update({ tau0: v })} />
                <p className="field-hint">사후평균 = {f4(w)}·x̄ + {f4(1 - w)}·m₀ (자료 쪽 가중치 w = {f4(w)})</p>
              </>
            )}
            <p className="field-hint">표기: N(a, b)에서 b는 분산입니다(교재 N(μ, σ²)와 같은 관례). 사전분포는 베이즈 패널에만 영향을 줍니다.</p>
          </div>
        </div>
      </section>

      <div className="views-grid">
        <article className="panel view-card" aria-labelledby="v-neyman">
          <p className="eyebrow">네이만 · 신뢰구간</p>
          <h3 id="v-neyman">[{f4(ci.lower)}, {f4(ci.upper)}]</h3>
          <Tex block>{String.raw`P_\mu\{\mu \in C(X)\} = ${level}\ \ (\text{모든 }\mu)`}</Tex>
          <NormalAreaChart mean={0} sd={1} lo={-(ci.upper - xbar) / se} hi={(ci.upper - xbar) / se} domain={[-4, 4]} xTitle="Z = (X̄ − μ)/SE — 관측 전의 무작위 양" color="var(--c-cover)" fill="var(--c-cover-fill)" areaLabel={L} ariaLabel={`표준정규분포에서 가운데 ${L}. 확률은 관측 전 X̄에 붙는다`} />
          <p className="view-sentence">{SENTENCES.neymanRepeat(L)}.</p>
          <p className="view-sentence">{SENTENCES.neymanObserved(L)}.</p>
          <p className="view-object">
            <b>확률의 대상</b> 관측 전 무작위 구간이 고정된 μ를 포함하는 사건
          </p>
        </article>

        <article className="panel view-card" aria-labelledby="v-bayes">
          <p className="eyebrow">베이즈 · 신용구간</p>
          <h3 id="v-bayes">[{f4(cb.lower)}, {f4(cb.upper)}]</h3>
          <Tex block>{flat ? String.raw`\pi(\mu)\propto 1 \Rightarrow \mu\mid x \sim N(${g(post.mean)},\ ${g(post.variance)})` : String.raw`\mu \sim N(${s.m0}, ${s.tau0}^2) \Rightarrow \mu\mid x \sim N(${g(post.mean)},\ ${g(post.variance)})`}</Tex>
          <NormalAreaChart
            mean={post.mean}
            sd={Math.sqrt(post.variance)}
            lo={cb.lower}
            hi={cb.upper}
            domain={domain}
            xTitle="μ — 사후분포 (자료 고정)"
            color="var(--c-pval)"
            fill="var(--c-pval-fill)"
            marks={[{ at: xbar, label: 'x̄', color: 'var(--c-truth)' }, ...(flat ? [] : [{ at: s.m0, label: 'm₀', color: 'var(--c-pval)', dash: '3 3' }])]}
            areaLabel={L}
            ariaLabel={`사후분포 N(${fmtNum(post.mean, 3)}, ${fmtNum(post.variance, 3)})의 가운데 ${L}`}
          />
          <p className="view-sentence">{SENTENCES.bayes(L)}.</p>
          <p className="view-object">
            <b>확률의 대상</b> 지정한 사전분포와 관측 자료 아래에서 μ에 대한 사후질량
          </p>
          {flat && <p className="field-hint">평탄 사전은 적분이 무한한 비정칙(improper) 사전이지만, 이 모형에서는 사후분포가 정칙인 정규분포가 됩니다.</p>}
        </article>

        <article className="panel view-card" aria-labelledby="v-fid">
          <p className="eyebrow">피셔 · 피듀셜</p>
          <h3 id="v-fid">[{f4(cf.lower)}, {f4(cf.upper)}]</h3>
          <Tex block>{String.raw`\bar X = \mu + ${g(se)}Z \ \Rightarrow\ \mu^* = ${xbar} - ${g(se)}Z`}</Tex>
          <NormalAreaChart mean={fid.mean} sd={Math.sqrt(fid.variance)} lo={cf.lower} hi={cf.upper} domain={domain} xTitle="μ* — 사전 없이 뒤집어 만든 분포" color="#176b30" fill="rgba(23, 107, 48, 0.16)" marks={[{ at: xbar, label: 'x̄', color: 'var(--c-truth)' }]} areaLabel={L} ariaLabel={`피듀셜 분포 N(${xbar}, ${fmtNum(fid.variance, 3)})의 가운데 ${L}`} />
          <p className="view-sentence">{SENTENCES.fiducial}.</p>
          <p className="view-object">
            <b>확률의 대상</b> 사전분포 없이 역변환으로 구성한 μ*의 분포. 참모수 μ가 무작위로 움직인다는 뜻이 아님
          </p>
        </article>
      </div>

      <div className={`note${flat ? ' blue' : ''}`} role="status" style={{ marginBottom: 24 }}>
        {flat ? (
          <>
            <strong>{SENTENCES.same}.</strong> 세 구간 모두 [{f4(ci.lower)}, {f4(ci.upper)}]입니다. 그렇다고 ‘네이만·피셔·베이즈 구간은 항상 같다’는 뜻은 아닙니다. 사전분포를 정규로 바꿔 보세요.
          </>
        ) : (
          <>
            <strong>사전분포를 바꾸자 베이즈 구간만 움직였습니다.</strong> 신뢰구간과 피듀셜 구간은 사전분포를 쓰지 않으므로 그대로 [{f4(ci.lower)}, {f4(ci.upper)}]이고, 신용구간은 [{f4(cb.lower)}, {f4(cb.upper)}]입니다. 이 신용구간의 사후질량은 여전히 {L}지만, 고정된 μ에서의 포함률은 더 이상 {L}가 아닙니다(아래 ③).
          </>
        )}
      </div>

      <div className="two-anim">
        <section className="panel chart-panel" aria-label="반복표집">
          <p className="eyebrow">① 반복표집 — 네이만의 확률</p>
          <h3>자료를 새로 뽑는다. 구간이 움직이고 μ는 고정</h3>
          <SliderField label="교육용 참값 μ (반복표집에만 쓰임)" value={s.mu} min={-1000} max={1000} step={1} onChange={(v) => update({ mu: v })} />
          <div className="run-bar" role="group" aria-label="새 표본 뽑기">
            {[1, 10, 100, 1000].map((m) => (
              <button key={m} type="button" className={m === 1 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => drawRep(m)}>
                {m.toLocaleString('ko-KR')}회
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => update({ k: 0, sel: -1 })} disabled={count === 0}>
              초기화
            </button>
          </div>
          <IntervalStack svgRef={svgRef} items={items} rows={ROWS} truth={mu} hideTruth={false} domain={stackDomain} selected={-1} onSelect={() => undefined} ariaLabel={`반복표집한 신뢰구간 최근 ${items.length}개, 참값 μ = ${mu} 고정`} />
          <StatGrid
            stats={[
              { tag: '신뢰구간이 μ를 포함', label: `${fmtInt(stats.covered)} / ${fmtInt(count)}`, value: pct(count ? stats.covered / count : NaN), sub: count ? `MC SE ${(mcSe(stats.covered, count) * 100).toFixed(2)}%p` : '' },
              { tag: '같은 표본의 신용구간', label: flat ? '평탄 사전: 신뢰구간과 같음' : `사전 N(${s.m0}, ${s.tau0}²)`, value: pct(count ? credCovered / count : NaN), tone: 'orange', sub: count ? `MC SE ${(mcSe(credCovered, count) * 100).toFixed(2)}%p` : '' },
            ]}
          />
        </section>

        <section className="panel chart-panel" aria-label="사후표집">
          <p className="eyebrow">② {source === 'bayes' ? '사후표집 — 베이즈의 확률' : 'μ* 표집 — 피듀셜 분포'}</p>
          <h3>자료는 고정. 뽑히는 것은 {source === 'bayes' ? 'μ의 사후표본' : 'μ*'}</h3>
          <Segmented<'bayes' | 'fid'>
            label="무엇을 뽑을까"
            value={source}
            options={[
              { value: 'bayes', label: '사후분포의 μ' },
              { value: 'fid', label: '피듀셜 분포의 μ*' },
            ]}
            onChange={setSource}
          />
          <div className="run-bar" role="group" aria-label={`${source === 'bayes' ? 'μ' : 'μ*'} 뽑기`}>
            {[1, 100, 1000, 10000].map((m) => (
              <button key={m} type="button" className={m === 1 ? 'btn-filled sm' : 'btn-outline sm'} onClick={() => drawPost(m)}>
                {m.toLocaleString('ko-KR')}개
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setPostK(0)} disabled={postK === 0}>
              초기화
            </button>
          </div>
          <DrawHist svgRef={postRef} draws={draws} dist={drawDist} interval={drawIv} domain={domain} observed={xbar} symbol={source === 'bayes' ? 'μ' : 'μ*'} color={source === 'bayes' ? 'var(--c-pval)' : '#176b30'} ariaLabel={`${source === 'bayes' ? '사후표본 μ' : 'μ*'} ${postK}개의 히스토그램, 관측 x̄ = ${xbar} 고정`} />
          <StatGrid
            stats={[
              { tag: '구간 안에 든 표본', label: `${fmtInt(inside)} / ${fmtInt(postK)}`, value: pct(postK ? inside / postK : NaN), sub: `구간의 ${source === 'bayes' ? '사후질량' : '피듀셜 확률'} ${pmass(1)}` },
              { tag: '관측 x̄', label: '뽑는 동안 바뀌지 않음', value: String(xbar), tone: 'orange' },
            ]}
          />
        </section>
      </div>
      <Legend
        items={[
          { color: 'var(--c-truth)', label: '①의 고정된 참값 μ / ②의 고정된 관측 x̄', pattern: 'fill' },
          { color: 'var(--c-cover)', label: '①에서 움직이는 것: 구간', pattern: 'fill' },
          { color: 'var(--c-pval)', label: '②에서 움직이는 것: 모수 쪽 표본', pattern: 'fill' },
        ]}
      />
      <p className="chart-caption" style={{ marginBottom: 24 }}>
        두 반복은 서로 다른 것을 반복합니다. ①은 같은 μ에서 새 자료를, ②는 같은 자료에서 새 μ(또는 μ*)를 뽑습니다. ①의 비율은 포함률, ②의 비율은 사후질량(또는 피듀셜 확률)을 추정합니다.
      </p>

      <section className="panel chart-panel" aria-label="사전 민감도" style={{ marginBottom: 24 }}>
        <p className="eyebrow">③ 사전 민감도 — 신용구간의 고정 μ 포함률</p>
        <h3>사후질량 {L}인 구간이 고정된 μ를 얼마나 자주 포함할까</h3>
        {flat ? (
          <p className="muted">평탄 사전에서는 신용구간이 신뢰구간과 같아 모든 μ에서 포함률이 정확히 {L}입니다. 위에서 사전분포를 ‘정규’로 바꾸면 곡선이 달라집니다.</p>
        ) : null}
        <CoverageMuChart sigma={sigma} n={n} level={level} prior={prior} domain={[Math.min(s.mu, xbar, flat ? xbar : s.m0) - 6 * se, Math.max(s.mu, xbar, flat ? xbar : s.m0) + 6 * se]} mark={s.mu} mc={count ? { value: credCovered / count, se: mcSe(credCovered, count) } : undefined} ariaLabel={`고정 μ에 따른 신용구간의 정확 포함률, μ = ${s.mu}에서 표시`} />
        <p className="chart-caption">점선: 신용구간의 정확 포함률(닫힌 식). 세로선: ①의 교육용 참값 μ = {s.mu}, ■: ①의 같은 표본으로 잰 몬테카를로 추정 ±2 SE. 사전평균에서 먼 μ일수록 축소 때문에 포함률이 떨어집니다.</p>
        <ExportBar s={s} update={update} experimentId="E07" svgRef={svgRef} csv={count ? () => replicatesCsv({ ...s, method: 'z', alt: 'two' }, reps, count, 'E07') : undefined} />
        {present && (
          <p className="kbd-help">
            강의 모드 단축키: <kbd>Space</kbd> ① 1회 · <kbd>P</kbd> ② 100개
          </p>
        )}
      </section>

      <section className="panel" aria-label="설명" style={{ marginBottom: 48 }}>
        <TextbookBadge>교재 9.1·9.2 · 9.4 [예 9.8] · 9.6 · p.335–361</TextbookBadge>
        <Fold title="왜 이 모형에서는 세 끝점이 같은가" open>
          <p>정규·σ 알려짐에서 피벗 Z = (X̄ − μ)/SE의 분포가 μ와 무관한 N(0, 1)입니다. 네이만은 이 피벗을 μ에 대한 부등식으로 풀고, 피셔는 관측 뒤에 같은 식을 μ*에 대해 뒤집으며, 평탄 사전의 베이즈 사후분포도 N(x̄, SE²)가 됩니다. 셋이 같은 숫자에 이르는 것은 이 모형의 대칭성 덕분이지 일반 원리가 아닙니다.</p>
        </Fold>
        <Fold title="역사: 원 논법과 현대 확장을 구분하기">
          <p>네이만의 신뢰구간 이론(1937)은 반복표집 성질로 구간을 정의합니다. 피셔의 피듀셜 논법(1930년대)은 사전분포 없이 모수에 대한 분포를 얻으려 했고, 다모수 문제에서 논쟁이 이어졌습니다. 오늘날의 일반화·근사 피듀셜 방법은 원 논법과 따로 표시해야 합니다. ‘피셔는 공식 하나, 네이만은 다른 공식 하나’라는 구도는 정확하지 않습니다.</p>
        </Fold>
        <Fold title="쓰지 않는 문장">
          <ul>
            <li>‘이 구간 안에 모수가 있을 확률이 {L}다’ — 네이만 구간에 대해 쓰지 않습니다.</li>
            <li>‘μ가 {L} 확률로 이 구간 안에서 움직인다’ — 어느 관점도 참모수가 움직인다고 말하지 않습니다.</li>
            <li>‘신용구간은 반복표집 포함률 {L}를 보장한다’ — ③의 곡선이 반례입니다.</li>
            <li>‘네이만·피셔·베이즈 구간은 항상 같다’ — 사전분포를 바꾸면 달라집니다.</li>
          </ul>
        </Fold>
      </section>
    </>
  )
}
