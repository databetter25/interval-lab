// E08 P2: 정규 허용구간 x̄ ± kS (양측) 또는 x̄ + kS (단측 상한). 반복표집으로 "β 이상을 덮은 비율 ≈ γ"를 확인한다
import { useMemo } from 'react'
import { normCdf } from '../engine/core/normal'
import { howeK, oneSidedK, twoSidedK } from '../engine/tolerance'
import { MassHist } from '../components/chart/MassHist'
import { Segmented, SliderField, StatGrid, Tex } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/format'
import { mcSe } from '../engine/repeat'
import type { LabState, Update } from '../state/labState'

const f4 = (v: number) => fmtNum(v, 4)
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')

interface Props {
  s: LabState
  update: Update
  reps: { xbar: Float64Array; s: Float64Array; count: number }
}

export function ToleranceSection({ s, update, reps }: Props) {
  const { n, mu, sigma } = s
  const beta = s.tb
  const gamma = s.tgm
  const two = s.tsd === 'two'
  const ks = useMemo(() => ({ k2: twoSidedK(n, beta, gamma), howe: howeK(n, beta, gamma), k1: oneSidedK(n, beta, gamma) }), [n, beta, gamma])
  const k = two ? ks.k2 : ks.k1
  const count = reps.count
  const res = useMemo(() => {
    const content = new Float64Array(count)
    let ok = 0
    let okHowe = 0
    for (let b = 0; b < count; b++) {
      const x = reps.xbar[b]
      const sd = reps.s[b]
      content[b] = two ? normCdf((x + k * sd - mu) / sigma) - normCdf((x - k * sd - mu) / sigma) : normCdf((x + k * sd - mu) / sigma)
      if (content[b] >= beta) ok++
      if (two && normCdf((x + ks.howe * sd - mu) / sigma) - normCdf((x - ks.howe * sd - mu) / sigma) >= beta) okHowe++
    }
    return { content, ok, okHowe }
  }, [reps.xbar, reps.s, count, k, two, mu, sigma, beta, ks.howe])
  const last = count ? { x: reps.xbar[count - 1], sd: reps.s[count - 1] } : null

  return (
    <div className="pivot-step" style={{ marginTop: 18 }}>
      <h3 className="chart-title">허용구간 계산 (P2): 모집단의 β 이상을 신뢰수준 γ로 덮는다</h3>
      <div className="design-pair">
        <div className="settings">
          <SliderField label="덮을 모집단 비율 β" value={beta} min={0.5} max={0.999} step={0.001} onChange={(v) => update({ tb: v })} format={(v) => pct(v)} />
          <SliderField label="신뢰수준 γ" value={gamma} min={0.5} max={0.999} step={0.001} onChange={(v) => update({ tgm: v })} format={(v) => pct(v)} />
          <Segmented<'two' | 'one'>
            label="형태"
            value={s.tsd}
            options={[
              { value: 'two', label: '양측 x̄ ± kS' },
              { value: 'one', label: '단측 상한 x̄ + kS' },
            ]}
            onChange={(v) => update({ tsd: v })}
          />
        </div>
        <StatGrid
          stats={[
            { tag: two ? '정확 양측 k' : '정확 단측 k', label: `n = ${n}, β = ${pct(beta)}, γ = ${pct(gamma)}`, value: f4(k), sub: two ? `Howe 근사 ${f4(ks.howe)}` : '비중심 t 분위수 / √n' },
            { tag: '이번 표본의 허용구간', label: last ? `x̄ = ${f4(last.x)}, S = ${f4(last.sd)}` : '표본을 뽑으세요', value: last ? (two ? `[${f4(last.x - k * last.sd)}, ${f4(last.x + k * last.sd)}]` : `(−∞, ${f4(last.x + k * last.sd)}]`) : '—', tone: 'orange' },
          ]}
        />
      </div>
      {count > 0 && (
        <>
          <MassHist values={res.content} beta={beta} color="#6e40c9" ariaLabel={`허용구간 ${count}개가 덮은 모집단 비율의 분포, β 이상 ${pct(res.ok / count)}`} />
          <StatGrid
            stats={[
              { tag: `β 이상을 덮은 반복`, label: `목표 γ = ${pct(gamma)}`, value: `${pct(res.ok / count)} ±${(2 * mcSe(res.ok, count) * 100).toFixed(1)}`, sub: `반복 ${fmtInt(count)}회` },
              ...(two ? [{ tag: 'Howe 근사로 만들면', label: '같은 표본', value: pct(res.okHowe / count), tone: 'orange' as const }] : []),
            ]}
          />
        </>
      )}
      <p className="chart-caption">
        예측구간(위)은 덮는 비율이 평균적으로 β일 뿐이지만, 허용구간은 ‘β 이상을 덮는’ 일이 γ의 확률로 일어나도록 만듭니다. σ를 모르므로 언제나 S를 씁니다. 계수는 정확 적분식(양측)과 비중심 t(단측)로 구하며, Howe(1969) 근사와 비교합니다(Krishnamoorthy & Mathew, 2009). 위의 ‘방법’이 z여도 허용구간은 S를 씁니다.
      </p>
      <Tex block>{String.raw`P_{\mu,\sigma}\Big\{\, P_Y\big(\bar X - kS \le Y \le \bar X + kS\big) \ge \beta \,\Big\} = \gamma`}</Tex>
    </div>
  )
}
