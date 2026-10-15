// E15 일반화 피듀셜 (PRD v2 P2): 로그정규 평균 θ = exp(μ + σ²/2)의 GPQ 구간을 Cox 근사·원 척도 t와 비교
import { useEffect, useMemo, useRef, useState } from 'react'
import { randomSeed } from '../engine/core/rng'
import { FID_METHODS, fidIntervals, gpqDraws, lognormalSample, summarize, type FidCoverage } from '../engine/fiducial'
import { mcSe } from '../engine/repeat'
import { BootHistChart } from '../components/chart/BootHistChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { SliderField, Tex, TextbookBadge } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const SAMPLING_DRAWS = 4000
const COVERAGE_R = 1000
const COVERAGE_M = 2000

export function E15({ s, update }: { s: LabState; update: Update }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { n, level } = s
  const mu = s.fm
  const sigma = s.fs
  const seed = s.seed < 0 ? 0 : s.seed
  const truth = Math.exp(mu + (sigma * sigma) / 2)
  const logTruth = mu + (sigma * sigma) / 2

  const sm = useMemo(() => summarize(lognormalSample(n, mu, sigma, seed, s.fi)), [n, mu, sigma, seed, s.fi])
  const G = useMemo(() => gpqDraws(sm, s.fg, seed, s.fi), [sm, s.fg, seed, s.fi])
  const iv = useMemo(() => fidIntervals(sm, G, level), [sm, G, level])
  const logHat = sm.xbar + sm.s2 / 2
  // 표본분포: 새 표본마다 x̄ + s²/2 (화면 표본·포함률 실험과 다른 번호)
  const sampling = useMemo(
    () =>
      Float64Array.from({ length: SAMPLING_DRAWS }, (_, j) => {
        const t = summarize(lognormalSample(n, mu, sigma, seed, 2_000_000 + j))
        return t.xbar + t.s2 / 2
      }),
    [n, mu, sigma, seed],
  )

  const key = `${n}|${mu}|${sigma}|${level}|${seed}`
  const [cov, setCov] = useState<{ key: string; res: FidCoverage } | null>(null)
  const [running, setRunning] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  useEffect(() => () => workerRef.current?.terminate(), [])
  const runCoverage = () => {
    workerRef.current?.terminate()
    const w = new Worker(new URL('../workers/fiducial.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    setRunning(true)
    w.onmessage = (e: MessageEvent<{ key: string; res: FidCoverage }>) => {
      setCov({ key: e.data.key, res: e.data.res })
      setRunning(false)
      w.terminate()
    }
    w.postMessage({ key, n, mu, sigma, M: COVERAGE_M, R: COVERAGE_R, level, seed })
  }
  const covNow = cov && cov.key === key ? cov.res : null
  const L = pct(level)
  const logBr = (lo: number, hi: number) => ({ lower: Math.log(lo), upper: Math.log(hi) })

  return (
    <>
      <Predict
        experimentId="E15"
        itemId="E15-P1"
        question={`로그정규 표본(n = ${n})에서 평균 θ = E[Y]의 ${L} 구간으로 원 척도의 t 구간 Ȳ ± t·S/√n을 쓰면 포함률은?`}
        choices={[
          { text: `거의 정확히 ${L}`, misconception: 'M6', feedback: 't 구간의 포함률은 정규성에 기대고 있습니다. 오른쪽으로 크게 치우친 모집단의 작은 표본에서는 명목수준을 꽤 밑돕니다.' },
          { text: `${L}보다 낮다`, correct: true, feedback: '맞습니다. 치우친 분포에서 S가 작게 나오는 표본이 많아 구간이 너무 짧고, 특히 참값이 구간 오른쪽으로 빠지는 일이 잦습니다.' },
          { text: `${L}보다 높다`, feedback: '반대입니다. 원 척도 t 구간은 치우친 모집단에서 대체로 모자랍니다. 포함률 실험을 돌려 보세요.' },
        ]}
        revealed={covNow !== null}
        waitHint="‘포함률 실험 실행’을 눌러 확인하세요."
        resultSummary={covNow ? `원 척도 t ${pct(covNow.covered.tRaw / covNow.R)}, GPQ ${pct(covNow.covered.gpq / covNow.R)}.` : ''}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>로그정규 모집단</h2>
          <p className="kbd-help" style={{ marginTop: 0 }}>
            Y = e^X, X ~ N(μ, σ²). 추정 대상은 평균 θ = e^(μ + σ²/2) = {f4(truth)}
          </p>
          <SliderField label="표본크기 n" value={n} min={3} max={200} step={1} onChange={(v) => update({ n: v })} />
          <SliderField label="로그 척도 μ" value={mu} min={LIMITS.fm[0]} max={LIMITS.fm[1]} step={0.1} onChange={(v) => update({ fm: v })} />
          <SliderField label="로그 척도 σ (치우침)" value={sigma} min={0.1} max={2.5} step={0.05} onChange={(v) => update({ fs: v })} />
          <SliderField label="GPQ 뽑기 수 M" value={s.fg} min={LIMITS.fg[0]} max={LIMITS.fg[1]} step={500} onChange={(v) => update({ fg: v })} />
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-filled sm" onClick={() => update((c) => ({ fi: c.fi + 1, seed: c.seed < 0 ? randomSeed() : c.seed }))}>
              새 관측 표본
            </button>
            <span className="kbd-help">표본 #{s.fi + 1}</span>
          </div>
          <AssumptionBadges items={['관측값들이 독립·동일분포', '로그를 취하면 정확히 정규']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="일반화 피듀셜">
          <h3 className="chart-title" style={{ marginTop: 0 }}>
            GPQ 분포(막대) 대 추정량의 표본분포(점선) — log θ 척도, n = {n}
          </h3>
          <BootHistChart
            svgRef={svgRef}
            boot={G}
            sampling={sampling}
            theta={logTruth}
            thetaHat={logHat}
            brackets={FID_METHODS.filter((m) => m.id !== 'tRaw' || iv.tRaw.lower > 0).map((m) => ({
              iv: logBr(iv[m.id].lower, iv[m.id].upper),
              label: `${m.short} [${f4(iv[m.id].lower)}, ${f4(iv[m.id].upper)}]`,
              color: m.color,
              dash: m.dash,
            }))}
            xTitle="log θ = μ + σ²/2 (괄호 안 숫자는 원 척도 θ)"
            ariaLabel={`GPQ 분포(M = ${s.fg})와 x̄ + s²/2의 표본분포. 관측 ${f4(logHat)}, 참값 ${f4(logTruth)} (log 척도)`}
          />
          <p className="chart-caption">
            막대는 관측 x̄ = {f4(sm.xbar)}, s² = {f4(sm.s2)}를 고정하고 Z, U만 다시 뽑은 G의 분포이고, 점선은 모집단에서 새 표본을 뽑을 때 x̄ + s²/2가 흔들리는 분포입니다. 부트스트랩(E14)처럼 GPQ 분포도 관측값 근처에 모입니다.
          </p>

          <h3 className="chart-title">이 표본에서 만든 {L} 구간 (원 척도 θ)</h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="일반화 피듀셜 구간 표">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col">방법</th>
                  <th scope="col">구간</th>
                  <th scope="col">참값 θ 포함</th>
                </tr>
              </thead>
              <tbody>
                {FID_METHODS.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.label}</th>
                    <td className="num">
                      [{f4(iv[m.id].lower)}, {f4(iv[m.id].upper)}]
                    </td>
                    <td>{iv[m.id].lower <= truth && truth <= iv[m.id].upper ? '○' : '✕'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-caption">마지막 줄은 일부러 넣은 잘못된 대상입니다. exp(로그 t 구간)은 중앙값 e^μ = {f4(Math.exp(mu))}의 정확한 구간이지 평균 θ의 구간이 아닙니다(E08: 추정 대상을 먼저 정하기).</p>

          <h3 className="chart-title">
            포함률 실험: 표본 {fmtInt(COVERAGE_R)}개 × GPQ {fmtInt(COVERAGE_M)}번
          </h3>
          <div className="run-bar">
            <button type="button" className="btn-outline sm" onClick={runCoverage} disabled={running}>
              {running ? '계산 중…' : covNow ? '다시 실행' : '포함률 실험 실행'}
            </button>
            {cov && cov.key !== key && <span className="kbd-help">설정이 바뀌었습니다. 다시 실행하세요.</span>}
          </div>
          {covNow && (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="포함률 실험 표">
              <table className="data-table compare-table">
                <thead>
                  <tr>
                    <th scope="col">방법</th>
                    <th scope="col">포함률</th>
                    <th scope="col">평균 길이</th>
                    <th scope="col">좌측 P(L &gt; θ)</th>
                    <th scope="col">우측 P(U &lt; θ)</th>
                  </tr>
                </thead>
                <tbody>
                  {FID_METHODS.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">{m.label}</th>
                      <td className={`num${covNow.covered[m.id] / covNow.R < level - 2 * mcSe(covNow.covered[m.id], covNow.R) ? ' under' : ''}`}>
                        {pct(covNow.covered[m.id] / covNow.R)} ±{(2 * mcSe(covNow.covered[m.id], covNow.R) * 100).toFixed(1)}
                      </td>
                      <td className="num">{f4(covNow.meanLength[m.id])}</td>
                      <td className="num">{pct(covNow.missLeft[m.id] / covNow.R)}</td>
                      <td className="num">{pct(covNow.missRight[m.id] / covNow.R)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="chart-caption">GPQ 구간은 정확한 신뢰구간이 아니지만, 작은 n에서도 포함률이 명목수준에 가깝다는 것이 시뮬레이션으로 알려져 있습니다. 이것은 유한 시뮬레이션의 결과이며 이론적 보장이 아닙니다.</p>
          <ExportBar s={s} update={update} experimentId="E15" svgRef={svgRef} />
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 밖 확장 (P2) · Weerahandi; Krishnamoorthy &amp; Mathew</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>피벗이 없을 때 피벗을 만든다</h2>
          <ExplainTabs
            intuition={
              <>
                <p>θ = e^(μ + σ²/2)에는 E03 같은 정확한 피벗이 없습니다. 장애모수 σ가 끼어 있기 때문입니다.</p>
                <p>일반화 피벗량은 관측값 x̄, s를 ‘숫자로 고정’하고, x̄와 s를 만든 무작위성(Z와 U)만 다시 뽑아 θ가 있을 법한 값들의 분포를 만듭니다. 그 분포의 가운데 {L}가 구간입니다.</p>
                <p>이것은 피셔가 1930년대에 제안한 고전적 피듀셜 논증과 구분되는 현대적 방법입니다. 확률은 여전히 θ에 붙지 않습니다: 우리가 평가하는 것은 구간을 만드는 절차의 포함률입니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`G_\mu = \bar x - Z\,\frac{s}{\sqrt n}\sqrt{\frac{n-1}{U}},\quad G_{\sigma^2} = \frac{(n-1)s^2}{U},\quad Z\sim N(0,1),\ U\sim\chi^2_{n-1}`}</Tex>
                <Tex block>{String.raw`G = G_\mu + \tfrac12 G_{\sigma^2},\qquad C = \big[e^{G_{(\alpha/2)}},\ e^{G_{(1-\alpha/2)}}\big]`}</Tex>
                <Tex block>{String.raw`\text{Cox: } \exp\!\Big(\bar x + \tfrac{s^2}{2} \pm z_{\alpha/2}\sqrt{\tfrac{s^2}{n} + \tfrac{s^4}{2(n-1)}}\Big)`}</Tex>
              </>
            }
            proof={
              <>
                <p>일반화 피벗량 G(X; x, θ)의 두 조건: (1) 관측값 x를 넣으면 G의 값이 θ가 된다, (2) G의 분포가 미지의 모수에 의존하지 않는다.</p>
                <p>
                  x̄ = μ + σZ/√n, s² = σ²U/(n−1)을 G_μ, G_σ²에 넣으면 각각 μ, σ²가 되므로 (1)이 성립하고, Z, U의 분포는 모수와 무관하므로 (2)도 성립합니다. 정확한 피벗과 달리 G를 θ에 대해 뒤집어 얻은 구간의 포함률은 일반적으로 정확히 1 − α가 아니므로 시뮬레이션으로 확인합니다.
                </p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
