// E14 부트스트랩 구간 (PRD v2 P2): 표본분포 대 재표집분포, 백분위수·basic·BCa
import { useEffect, useMemo, useRef, useState } from 'react'
import { randomSeed } from '../engine/core/rng'
import { BOOT_METHODS, bootIntervals, bootstrapStats, statistic, trueParam, type BootCoverage, type BootStat } from '../engine/bootstrap'
import { meanInterval } from '../engine/meanInterval'
import { mcSe } from '../engine/repeat'
import { POPULATIONS, popData, type Population } from '../engine/robust'
import { BootHistChart } from '../components/chart/BootHistChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Segmented, SliderField, Tex, TextbookBadge } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const SAMPLING_DRAWS = 4000
const COVERAGE_R = 500

const STAT_LABEL: Record<BootStat, string> = { mean: '평균', median: '중앙값', var: '분산' }

export function E14({ s, update }: { s: LabState; update: Update }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { pop, mu, sigma, n, level } = s
  const kind = s.bst
  const seed = s.seed < 0 ? 0 : s.seed
  const truth = trueParam(kind, pop, mu, sigma)
  const spec = { pop, mu, sigma, n, seed }

  const x = useMemo(() => popData(spec, s.bsi), [pop, mu, sigma, n, seed, s.bsi]) // eslint-disable-line react-hooks/exhaustive-deps
  const boot = useMemo(() => bootstrapStats(kind, x, s.bb, seed, s.bsi), [kind, x, s.bb, seed, s.bsi])
  const iv = useMemo(() => bootIntervals(kind, x, boot, level), [kind, x, boot, level])
  // 표본분포: 모집단에서 새 표본을 뽑은 통계량 (화면 표본·포함률 실험과 다른 번호)
  const sampling = useMemo(() => Float64Array.from({ length: SAMPLING_DRAWS }, (_, j) => statistic(kind, popData(spec, 2_000_000 + j))), [kind, pop, mu, sigma, n, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const classical = kind === 'mean' ? meanInterval('t', iv.theta, Math.sqrt(statistic('var', x)), n, level) : null

  // 포함률 실험 (Worker, 버튼으로 시작)
  const key = `${kind}|${pop}|${mu}|${sigma}|${n}|${s.bb}|${level}|${seed}`
  const [cov, setCov] = useState<{ key: string; res: BootCoverage } | null>(null)
  const [running, setRunning] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  useEffect(() => () => workerRef.current?.terminate(), [])
  const runCoverage = () => {
    workerRef.current?.terminate()
    const w = new Worker(new URL('../workers/bootstrap.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    setRunning(true)
    w.onmessage = (e: MessageEvent<{ key: string; res: BootCoverage }>) => {
      setCov({ key: e.data.key, res: e.data.res })
      setRunning(false)
      w.terminate()
    }
    w.postMessage({ key, kind, pop, mu, sigma, n, B: Math.min(s.bb, 1000), R: COVERAGE_R, level, seed })
  }
  const covNow = cov && cov.key === key ? cov.res : null

  const bootMean = boot.reduce((a, v) => a + v, 0) / boot.length
  const sampMean = sampling.reduce((a, v) => a + v, 0) / sampling.length
  const sd = (v: ArrayLike<number>, m: number) => Math.sqrt(Array.from(v).reduce((a, t) => a + (t - m) ** 2, 0) / (v.length - 1))
  const L = pct(level)

  return (
    <>
      <Predict
        experimentId="E14"
        itemId="E14-P1"
        question="관측 표본 하나에서 복원추출로 재표집한 통계량들(재표집분포)의 중심은 어디에 있을까요?"
        choices={[
          { text: '참값 θ', misconception: 'M1', feedback: '재표집은 관측 표본 안에서만 일어나므로 참값을 알 길이 없습니다. 중심은 관측값 θ̂ 근처입니다.' },
          { text: '관측값 θ̂ 근처', correct: true, feedback: '재표집분포는 θ̂ 근처에 모이고, 그 퍼짐이 표본분포의 퍼짐을 흉내 냅니다. 그래서 부트스트랩은 ‘θ̂가 θ에서 얼마나 흔들리는지’를 θ̂ 주변의 흔들림으로 근사합니다.' },
          { text: '0', feedback: '통계량의 값 자체를 재표집하므로 0과는 관계가 없습니다.' },
          { text: '표본마다 정해지지 않는다', feedback: '관측 표본이 정해지면 재표집분포도(B가 크면) 거의 정해집니다. 새 표본을 뽑으면 중심이 그 표본의 θ̂로 옮겨 갑니다.' },
        ]}
        revealed={s.bsi > 0}
        waitHint="‘새 관측 표본’을 눌러 재표집분포가 어디로 옮겨 가는지 보세요."
        resultSummary={`지금 θ̂ = ${f4(iv.theta)}, 재표집분포의 평균 ${f4(bootMean)}, 참값 θ = ${f4(truth)}.`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>모집단과 통계량</h2>
          <Segmented<Population> label="모집단 (평균·분산 맞춤)" value={pop} options={POPULATIONS.map((p) => ({ value: p.id, label: p.label.replace(/ \(.*\)/, '') }))} onChange={(v) => update({ pop: v })} />
          <Segmented<BootStat>
            label="통계량"
            value={kind}
            options={[
              { value: 'mean', label: '평균' },
              { value: 'median', label: '중앙값' },
              { value: 'var', label: '분산' },
            ]}
            onChange={(v) => update({ bst: v })}
          />
          <SliderField label="표본크기 n" value={n} min={5} max={200} step={1} onChange={(v) => update({ n: v })} />
          <SliderField label="재표집 수 B" value={s.bb} min={LIMITS.bb[0]} max={10000} step={100} onChange={(v) => update({ bb: v })} />
          <SliderField label="신뢰수준 1−α" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => pct(v)} />
          <SliderField label="평균 μ" value={mu} min={-1000} max={1000} step={1} onChange={(v) => update({ mu: v })} />
          <SliderField label="표준편차 σ" value={sigma} min={0.5} max={100} step={0.5} onChange={(v) => update({ sigma: v })} />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn-filled sm" onClick={() => update((c) => ({ bsi: c.bsi + 1, seed: c.seed < 0 ? randomSeed() : c.seed }))}>
              새 관측 표본
            </button>
            <span className="kbd-help">표본 #{s.bsi + 1}</span>
          </div>
          <AssumptionBadges items={['관측값들이 독립·동일분포', '표본이 모집단을 대표']} />
        </aside>

        <section className="col-chart panel chart-panel" aria-label="부트스트랩">
          <h3 className="chart-title" style={{ marginTop: 0 }}>
            재표집분포(막대) 대 표본분포(점선) — {STAT_LABEL[kind]}, n = {n}
          </h3>
          <BootHistChart
            svgRef={svgRef}
            boot={boot}
            sampling={sampling}
            theta={truth}
            thetaHat={iv.theta}
            brackets={BOOT_METHODS.map((m) => ({ iv: iv[m.id], label: `${m.label.split(' ')[0]} [${f4(iv[m.id].lower)}, ${f4(iv[m.id].upper)}]`, color: m.color, dash: m.dash }))}
            xTitle={`${STAT_LABEL[kind]}의 값`}
            ariaLabel={`재표집분포(B = ${s.bb})와 표본분포(${SAMPLING_DRAWS}개 새 표본). 관측 ${f4(iv.theta)}, 참값 ${f4(truth)}`}
          />
          <div className="table-scroll" tabIndex={0} role="region" aria-label="두 분포 비교 표">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col">분포</th>
                  <th scope="col">무엇을 반복하나</th>
                  <th scope="col">중심</th>
                  <th scope="col">퍼짐 (표준편차)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">표본분포 (점선)</th>
                  <td>모집단에서 새 표본 {fmtInt(SAMPLING_DRAWS)}개</td>
                  <td className="num">{f4(sampMean)} (참값 {f4(truth)} 근처)</td>
                  <td className="num">{f4(sd(sampling, sampMean))}</td>
                </tr>
                <tr>
                  <th scope="row">재표집분포 (막대)</th>
                  <td>관측 표본 하나에서 복원추출 {fmtInt(s.bb)}번</td>
                  <td className="num">{f4(bootMean)} (θ̂ = {f4(iv.theta)} 근처)</td>
                  <td className="num">{f4(sd(boot, bootMean))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="chart-caption">실제 연구에서는 표본분포를 볼 수 없습니다. 부트스트랩은 그 퍼짐을 재표집분포의 퍼짐으로 대신합니다. 중심은 참값이 아니라 관측값에 있습니다.</p>

          <h3 className="chart-title">이 표본에서 만든 {L} 구간</h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="부트스트랩 구간 표">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col">방법</th>
                  <th scope="col">구간</th>
                  <th scope="col">참값 포함</th>
                </tr>
              </thead>
              <tbody>
                {BOOT_METHODS.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.label}</th>
                    <td className="num">
                      [{f4(iv[m.id].lower)}, {f4(iv[m.id].upper)}]
                    </td>
                    <td>{iv[m.id].lower <= truth && truth <= iv[m.id].upper ? '○' : '✕'}</td>
                  </tr>
                ))}
                {classical && (
                  <tr>
                    <th scope="row">t 구간 (정규 가정, 비교)</th>
                    <td className="num">
                      [{f4(classical.lower)}, {f4(classical.upper)}]
                    </td>
                    <td>{classical.lower <= truth && truth <= classical.upper ? '○' : '✕'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="chart-caption">
            BCa 보정값: z₀ = {f4(iv.z0)}(재표집분포가 θ̂보다 작은 쪽으로 치우친 정도), a = {f4(iv.a)}(잭나이프로 잰 가속). 둘 다 0이면 BCa = 백분위수입니다.
          </p>

          <h3 className="chart-title">포함률 실험: 표본 {COVERAGE_R}개 × 재표집 {Math.min(s.bb, 1000)}번</h3>
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
                  {BOOT_METHODS.map((m) => (
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
          <p className="chart-caption">부트스트랩 구간도 근사입니다. 작은 n이나 치우친 모집단에서는 명목수준을 밑돌 수 있고, BCa가 대체로 가장 낫지만 보장은 없습니다. 유한 시뮬레이션의 결과이며 이론적 보장이 아닙니다.</p>
          <ExportBar s={s} update={update} experimentId="E14" svgRef={svgRef} />
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 밖 확장 (P2) · Efron &amp; Tibshirani</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>표본분포를 볼 수 없을 때</h2>
          <ExplainTabs
            intuition={
              <>
                <p>구간을 만들려면 θ̂가 참값 주위에서 얼마나 흔들리는지(표본분포)를 알아야 합니다. 피벗이 없으면 그 분포를 공식으로 알 수 없습니다.</p>
                <p>부트스트랩은 관측 표본을 모집단 삼아 다시 뽑아서, θ̂*가 θ̂ 주위에서 흔들리는 모양으로 θ̂가 θ 주위에서 흔들리는 모양을 대신합니다.</p>
              </>
            }
            calc={
              <>
                <Tex block>{String.raw`\text{백분위수: } [\hat\theta^*_{(\alpha/2)},\ \hat\theta^*_{(1-\alpha/2)}]`}</Tex>
                <Tex block>{String.raw`\text{basic: } [2\hat\theta - \hat\theta^*_{(1-\alpha/2)},\ 2\hat\theta - \hat\theta^*_{(\alpha/2)}]`}</Tex>
                <Tex block>{String.raw`\text{BCa: } \alpha_{1,2} = \Phi\!\left(z_0 + \frac{z_0 + z_{\alpha/2,\,1-\alpha/2}}{1 - a(z_0 + z_{\alpha/2,\,1-\alpha/2})}\right)`}</Tex>
              </>
            }
            proof={
              <>
                <p>basic 구간은 θ̂* − θ̂의 분포가 θ̂ − θ의 분포와 같다고 보고 피벗처럼 뒤집은 것입니다(E03과 같은 구조). 백분위수 구간은 θ̂*의 분위수를 그대로 씁니다.</p>
                <p>BCa는 단조변환 아래에서 정규 근사가 성립한다고 보고, 중앙 편향 z₀ = Φ⁻¹(P(θ̂* &lt; θ̂))와 분산이 θ에 따라 변하는 정도 a(가속, 잭나이프 추정)로 백분위수의 위치를 보정합니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
