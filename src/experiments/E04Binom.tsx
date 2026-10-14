// E04 이항 검정 역산과 p-값 함수 (PRD v2 §7 E04 P1) — 정확검정·score·Wald
import { useEffect, useRef, useState } from 'react'
import { BINOM_METHODS, binomAcceptance, binomCdf, binomInterval, binomSfIncl, binomTestP, type BinomMethod } from '../engine/binomial'
import { normPpf } from '../engine/core/normal'
import { contains } from '../engine/meanInterval'
import { BinomPFunctionChart } from '../components/chart/BinomPFunctionChart'
import { PmfChart } from '../components/chart/PmfChart'
import { AssumptionBadges, ExplainTabs, ExportBar, Predict } from '../components/lab'
import { Legend, Segmented, SliderField, StatGrid, Tex, TextbookBadge } from '../components/ui'
import { fmtNum, formatSet } from '../lib/format'
import { usePresent, useShortcuts } from '../lib/present'
import { LIMITS, type LabState, type Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const fp = (p: number) => (p < 1e-4 && p > 0 ? p.toExponential(3) : p.toFixed(4))
const COMPARE_COLORS: Record<BinomMethod, string> = { cp: 'var(--c-accept)', wilson: '#176b30', wald: 'var(--c-miss)' }
const SHORT: Record<BinomMethod, string> = { cp: '정확 (CP)', wilson: 'score', wald: 'Wald' }

export function E04Binom({ s, update }: { s: LabState; update: Update }) {
  const present = usePresent()
  const svgRef = useRef<SVGSVGElement>(null)
  const [nested, setNested] = useState(false)
  const { bn: n, level, bmethod: method } = s
  const x = Math.min(s.bx, n)
  const p0 = s.p0
  const alpha = 1 - level
  const pval = binomTestP(x, n, p0, method)
  const reject = pval < alpha
  const ci = binomInterval(x, n, level, method)
  const inCI = contains(ci, p0)
  const accept = binomAcceptance(n, p0, level, method)
  const meta = BINOM_METHODS.find((m) => m.id === method)!
  const compare = s.cmp ? BINOM_METHODS.filter((m) => m.id !== method).map((m) => ({ method: m.id, color: COMPARE_COLORS[m.id] })) : []

  // 정확검정의 두 꼬리: p = min(1, 2 × 작은 쪽)
  const lowerTail = binomCdf(x, n, p0)
  const upperTail = binomSfIncl(x, n, p0)
  const smallerIsLower = lowerTail <= upperTail
  const pBars = method === 'cp' ? Array.from({ length: n + 1 }, (_, k) => (smallerIsLower ? k <= x : k >= x)) : undefined
  const endP = [ci.lower, ci.upper].filter((v) => v > 0 && v < 1).map((v) => binomTestP(x, n, v, method))

  const first = useRef(reject)
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    if (reject !== first.current) setFlipped(true)
  }, [reject])

  const nudge = (d: number) => update((cur) => ({ p0: Math.min(1, Math.max(0, Number((cur.p0 + d * 0.005).toFixed(6)))) }))
  useShortcuts({ ArrowRight: () => nudge(1), ArrowLeft: () => nudge(-1) }, present)

  const z = normPpf(1 - alpha / 2)
  const ph = x / n

  return (
    <>
      <Predict
        experimentId="E04"
        itemId="E04-P2-binom"
        question={`x = ${x}, n = ${n}. 정확검정으로 H₀: p = p₀를 검정할 때, p₀를 움직이면 기각 결정은 어디서 바뀔까요?`}
        choices={[
          { text: 'Clopper–Pearson 구간의 끝점에서', correct: true, feedback: '정확검정에서 기각되지 않는 p₀를 모두 모은 것이 Clopper–Pearson 구간입니다. 끝점에서 정확검정의 p-값은 정확히 α입니다.' },
          { text: 'p̂ ± 1.96·√(p̂(1−p̂)/n) (교재 8.6.1 구간)의 끝점에서', misconception: 'M4', feedback: '그 끝점은 Wald 검정을 뒤집은 구간의 끝점입니다. 검정이 다르면 결정이 바뀌는 경계도, 그래서 구간도 다릅니다. ‘뒤집는 검정’을 Wald로 바꿔 확인해 보세요.' },
          { text: 'p₀가 p̂ = x/n과 같아질 때', misconception: 'M10', feedback: 'p₀ = p̂ 근처에서는 p-값이 가장 크므로 기각하기 가장 어렵습니다. 결정은 p̂에서 충분히 멀어질 때 바뀝니다.' },
          { text: '이산분포라서 결정이 바뀌는 경계가 없다', misconception: 'M4', feedback: 'x는 정수이지만 p₀는 연속으로 움직입니다. p-값은 p₀의 연속함수이므로 α와 만나는 경계가 분명히 있습니다.' },
        ]}
        revealed={flipped}
        waitHint="p₀ 슬라이더를 움직여 결정이 바뀌는 순간을 찾아보세요."
        resultSummary={`정확검정(CP)의 경계는 [${f4(binomInterval(x, n, level, 'cp').lower)}, ${f4(binomInterval(x, n, level, 'cp').upper)}]입니다.`}
      />

      <div className="lab-grid">
        <aside className="col-settings panel settings" aria-label="설정">
          <h2>관측 자료와 검정</h2>
          <div className="field">
            <span className="field-label">프리셋</span>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn-outline sm" onClick={() => update({ bn: 10, bx: 3, p0: 0.05, level: 0.95, bmethod: 'cp' })}>
                기준 사례 (n=10, x=3)
              </button>
              <button type="button" className="btn-outline sm" title="x = 0: 경계의 구간" onClick={() => update({ bn: 10, bx: 0, p0: 0.2, level: 0.95 })}>
                x = 0
              </button>
            </div>
          </div>
          <SliderField label="시행 수 n" value={n} min={LIMITS.bn[0]} max={LIMITS.bn[1]} step={1} onChange={(bn) => update((cur) => ({ bn, bx: Math.min(cur.bx, bn) }))} />
          <SliderField label="관측 x (성공 수)" value={x} min={0} max={n} step={1} onChange={(bx) => update({ bx })} />
          <SliderField label="신뢰수준 1−α (유의수준 α)" value={level} min={LIMITS.level[0]} max={LIMITS.level[1]} step={0.001} onChange={(v) => update({ level: v })} format={(v) => `${(v * 100).toFixed(1)}% (α = ${Number((1 - v).toFixed(4))})`} />
          <Segmented<BinomMethod> label="검정 ↔ 구간" value={method} options={BINOM_METHODS.map((m) => ({ value: m.id, label: SHORT[m.id] }))} onChange={(bmethod) => update({ bmethod })} />
          <p className="field-hint">
            {meta.test}
            {meta.scope === '교재' ? ' · 교재 8.6.1' : ' · 교재 밖 확장'}
          </p>
          <SliderField label="가설값 p₀" value={p0} min={0} max={1} step={0.001} onChange={(v) => update({ p0: v })} format={(v) => v.toFixed(3)} />
          <label className="row" style={{ gap: 8, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={s.cmp} onChange={(e) => update({ cmp: e.target.checked })} />
            다른 검정의 p-값 함수 겹쳐 보기
          </label>
          <label className="row" style={{ gap: 8, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={nested} onChange={(e) => setNested(e.target.checked)} />
            여러 신뢰수준 겹쳐 보기 (신뢰 곡선)
          </label>
          <AssumptionBadges items={['독립 베르누이 시행', 'n 고정', '양측']} />
          <p className="field-hint">기각 규칙: p &lt; α이면 기각합니다. 그래서 끝점(p = α)은 구간에 포함됩니다.</p>
        </aside>

        <section className="col-chart panel chart-panel" aria-label="이항 검정과 구간">
          <div className={`verdict ${reject ? 'reject' : 'keep'}`} role="status" aria-live="polite">
            H₀: p = {p0.toFixed(3)} vs H₁: p ≠ p₀ · {SHORT[method]} 검정 · p = {fp(pval)} → {reject ? `기각 (p < α = ${Number(alpha.toFixed(4))})` : `기각하지 않음 (p ≥ α = ${Number(alpha.toFixed(4))})`}
          </div>
          <div className="duality">
            <span>{reject ? 'H₀ 기각' : 'H₀ 기각하지 않음'}</span>
            <span className="eq">⟺</span>
            <span>
              p₀ = {p0.toFixed(3)} {inCI ? '∈' : '∉'} [{f4(ci.lower)}, {f4(ci.upper)}]
            </span>
            <span className="eq">⟺</span>
            <span>
              x = {x} {accept[x] ? '∈' : '∉'} A({p0.toFixed(3)})
            </span>
          </div>

          <h3 className="chart-title">p-값 함수 p(p₀): 높이 α에서 자르면 신뢰구간</h3>
          <BinomPFunctionChart svgRef={svgRef} x={x} n={n} level={level} method={method} compare={compare} p0={p0} nested={nested} ariaLabel={`${meta.label} 검정의 p-값 함수. p₀ = ${p0.toFixed(3)}에서 p = ${fp(pval)}. α 선과 만나는 점이 구간 [${f4(ci.lower)}, ${f4(ci.upper)}]의 끝점`} />
          <Legend
            items={[
              { color: 'var(--c-pval)', label: `${meta.label} p-값 함수` },
              ...compare.map((c) => ({ color: c.color, label: `${BINOM_METHODS.find((m) => m.id === c.method)!.label} (점선)`, pattern: 'line' as const })),
              { color: 'var(--c-reject)', label: 'α 선', pattern: 'line' as const },
              { color: 'var(--c-obs)', label: '신뢰구간 (α 선 위의 구간)', pattern: 'fill' as const },
            ]}
          />

          <h3 className="chart-title">7장의 그림: H₀: p = p₀에서 X ~ Binomial({n}, p₀)</h3>
          <PmfChart n={n} p0={p0} accept={accept} observed={x} pBars={pBars} ariaLabel={`귀무분포 Binomial(${n}, ${p0.toFixed(3)}), 채택역 ${formatSet(accept)}, 관측 x = ${x}`} />
          <p className="chart-caption">
            {method === 'cp'
              ? `보라 테두리: 정확검정의 p-값을 이루는 작은 쪽 꼬리 P(X ${smallerIsLower ? '≤' : '≥'} ${x}) = ${fp(smallerIsLower ? lowerTail : upperTail)}. 양측 p-값은 그 2배(최대 1)입니다.`
              : `${meta.label} 검정은 정규근사로 p-값을 계산합니다. 막대는 정확한 이항분포와 그 검정의 채택역(채운 막대)을 보여 줍니다.`}
          </p>

          <StatGrid
            stats={[
              { tag: '신뢰구간', label: `${meta.label} ${(level * 100).toFixed(1)}%`, value: `[${f4(ci.lower)}, ${f4(ci.upper)}]` },
              { tag: '끝점에서의 p-값', label: endP.length ? '= α' : '끝점이 0 또는 1', value: endP.length ? endP.map((v) => v.toFixed(6)).join(' · ') : '—', sub: ci.lower === 0 || ci.upper === 1 ? '경계에 붙은 끝점은 α와 만나지 않음' : undefined },
              { tag: method === 'cp' ? '두 꼬리' : '통계량', label: method === 'cp' ? 'P(X ≤ x) · P(X ≥ x)' : 'z', value: method === 'cp' ? `${fp(lowerTail)} · ${fp(upperTail)}` : fmtNum(method === 'wilson' ? (x - n * p0) / Math.sqrt(n * p0 * (1 - p0)) : (ph - p0) / Math.sqrt((ph * (1 - ph)) / n), 4), tone: 'orange' },
            ]}
          />
          <ExportBar s={s} update={update} experimentId="E04" svgRef={svgRef} />
          {present && (
            <p className="kbd-help">
              강의 모드 단축키: <kbd>←</kbd> <kbd>→</kbd> p₀ 이동
            </p>
          )}
        </section>

        <aside className="col-explain panel" aria-label="설명">
          <TextbookBadge>교재 8.6.1 · 8.7 정리 8.10 · p.319–324</TextbookBadge>
          <h2 style={{ marginTop: 10 }}>어떤 검정을 뒤집느냐가 구간을 정한다</h2>
          <ExplainTabs
            intuition={
              <>
                <p>같은 자료 x = {x}로 p₀를 바꿔 가며 검정을 반복합니다. 기각되지 않는 p₀를 모으면 구간이 됩니다.</p>
                <p>정확검정, score 검정, Wald 검정은 같은 자료에도 서로 다른 p-값을 주므로 p-값 함수의 모양이 다르고, α에서 자른 구간도 다릅니다. ‘다른 검정의 p-값 함수 겹쳐 보기’로 비교해 보세요.</p>
                <p className="muted">x = 0이나 x = n에서는 Wald 검정의 표준오차가 0이 되어 p₀ = p̂ 한 점 말고는 모두 기각합니다. 그래서 Wald 구간이 한 점으로 퇴화합니다.</p>
              </>
            }
            calc={
              <>
                {method === 'cp' && <Tex block>{String.raw`p = \min\{1,\ 2\min(P_{p_0}(X\le ${x}),\ P_{p_0}(X\ge ${x}))\} = ${fp(pval)}`}</Tex>}
                {method === 'wilson' && <Tex block>{String.raw`z = \frac{x - n p_0}{\sqrt{n p_0(1-p_0)}},\quad p = 2\{1-\Phi(|z|)\} = ${fp(pval)}`}</Tex>}
                {method === 'wald' && <Tex block>{String.raw`z = \frac{\hat p - p_0}{\sqrt{\hat p(1-\hat p)/n}},\quad p = 2\{1-\Phi(|z|)\} = ${fp(pval)}`}</Tex>}
                <Tex block>{String.raw`C = [${f4(ci.lower)},\ ${f4(ci.upper)}]`}</Tex>
                {method === 'wald' && <Tex block>{String.raw`\hat p \pm ${z.toFixed(4)}\sqrt{\hat p(1-\hat p)/n} = ${ph.toFixed(4)} \pm ${(z * Math.sqrt((ph * (1 - ph)) / n)).toFixed(4)}`}</Tex>}
              </>
            }
            proof={
              <>
                <p>정확검정은 두 꼬리가 모두 α/2 이상일 때 기각하지 않습니다.</p>
                <Tex block>{String.raw`C(x) = \{p_0 : P_{p_0}(X\ge x)\ge \tfrac{\alpha}{2},\ P_{p_0}(X\le x)\ge \tfrac{\alpha}{2}\}`}</Tex>
                <p>P_p(X ≥ x)는 p에 대해 증가, P_p(X ≤ x)는 감소하므로 이 집합은 구간이고, 끝점에서 해당 꼬리가 정확히 α/2입니다(p-값 = α).</p>
                <Tex block>{String.raw`L = Q_{\alpha/2}\{\mathrm{Beta}(x,n-x+1)\},\quad U = Q_{1-\alpha/2}\{\mathrm{Beta}(x+1,n-x)\}`}</Tex>
                <p>score 검정의 부등식 |x − np₀| ≤ z√(np₀(1−p₀))을 p₀에 대해 풀면 Wilson 구간이, Wald 검정의 부등식을 풀면 교재 8.6.1의 구간이 나옵니다.</p>
              </>
            }
          />
        </aside>
      </div>
    </>
  )
}
