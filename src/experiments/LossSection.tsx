// E10 P2: 손실함수 관점 (CB 9.3.4). 손실 L = b·길이 − 1{θ ∈ C}의 위험을 최소화하면 신뢰수준이 정해진다
import { costForLevel, impliedLevel, lossRisk, optimalHalfWidth } from '../engine/accuracy'
import { criticalValue, standardError } from '../engine/meanInterval'
import { DesignCurveChart } from '../components/chart/DesignCurveChart'
import { SliderField, StatGrid, Tex } from '../components/ui'
import { fmtNum } from '../lib/format'
import type { LabState, Update } from '../state/labState'

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`

export function LossSection({ s, update }: { s: LabState; update: Update }) {
  const se = standardError(s.sigma, s.n)
  const b = s.lc
  const c = optimalHalfWidth(b, se)
  const lv = impliedLevel(b, se)
  const q = criticalValue('z', s.level, s.n, 'two')
  const b95 = costForLevel(0.95, se)
  return (
    <div className="pivot-step" style={{ marginTop: 18 }}>
      <h3 className="chart-title">손실함수 관점 (P2): 신뢰수준도 고를 수 있는 양이다</h3>
      <p className="chart-caption" style={{ marginTop: 0 }}>
        구간 x̄ ± c·SE에 손실 L = b·길이 − 1{'{'}θ ∈ C{'}'}를 매기면 위험은 R(c) = 2bc·SE − (2Φ(c) − 1)입니다. 길이 1당 비용 b를 정하면 위험을 최소로 하는 c*가 정해지고, 그 포함률이 곧 ‘이 손실이 고른 신뢰수준’입니다.
      </p>
      <div>
        <div className="settings">
          <SliderField label="길이 1당 비용 b (로그 눈금)" value={Number(Math.log10(b).toFixed(2))} min={-4} max={0} step={0.01} onChange={(v) => update({ lc: Number((10 ** v).toPrecision(4)) })} format={() => `b = ${b.toPrecision(3)}`} hint={`지금 SE = ${fmtNum(se, 3)}에서 95%와 같은 비용은 b = ${b95.toPrecision(3)}`} />
          <button type="button" className="btn-outline sm" onClick={() => update({ lc: Number(b95.toPrecision(4)) })}>
            95%와 같은 b로
          </button>
        </div>
        <StatGrid
          stats={[
            { tag: '최적 반폭 c*', label: 'φ(c*) = b·SE', value: c > 0 ? fmtNum(c, 4) : '0 (구간 없음)' },
            { tag: '이 손실이 고른 신뢰수준', label: '2Φ(c*) − 1', value: pct(lv, 2), tone: 'orange' },
          ]}
        />
      </div>
      <DesignCurveChart
        domain={[0, 4]}
        series={[{ label: '위험', color: 'var(--c-pval)', f: (x) => lossRisk(x, b, se) + 1 }]}
        marks={[
          ...(c > 0 ? [{ x: c, label: `c* = ${fmtNum(c, 3)} (${pct(lv)})`, color: 'var(--c-miss)' }] : []),
          ...(Math.abs(q - c) < 0.15 ? [] : [{ x: Math.min(q, 4), label: `지금 수준 ${pct(s.level)}: c = ${fmtNum(q, 3)}`, color: 'var(--c-truth)' }]),
        ]}
        xTitle="반폭 c (SE 단위)"
        yTitle="위험 R(c) + 1"
        xTickCount={5}
        ariaLabel={`위험 곡선, 최소점 c* = ${fmtNum(c, 4)}, 신뢰수준 ${pct(lv, 2)}`}
        height={210}
      />
      <DesignCurveChart
        domain={[2, 400]}
        series={[{ label: '수준', color: 'var(--c-cover)', f: (n) => impliedLevel(b, standardError(s.sigma, n)) }]}
        marks={[{ x: Math.min(400, Math.max(2, s.n)), label: `n = ${s.n}: ${pct(lv)}`, color: 'var(--c-truth)' }]}
        xLog
        xTitle="표본크기 n (같은 b, σ)"
        yTitle="고른 신뢰수준"
        yFormat={(v) => `${Math.round(v * 100)}%`}
        ariaLabel={`같은 비용 b에서 n에 따라 고른 신뢰수준`}
        height={200}
      />
      <p className="chart-caption">길이 비용을 고정하면 n이 클수록(SE가 작을수록) 더 높은 신뢰수준을 고르는 것이 최적입니다. ‘언제나 95%’는 관례이지 이 손실의 최적해가 아닙니다. 다만 b를 정하는 것 자체가 주관적 선택입니다.</p>
      <Tex block>{String.raw`R(c) = E_\theta\big[b\cdot\text{길이}(C) - \mathbf 1\{\theta\in C\}\big] = 2bc\,\mathrm{SE} - (2\Phi(c)-1)`}</Tex>
      <Tex block>{String.raw`R'(c^*) = 0 \iff \phi(c^*) = b\,\mathrm{SE}`}</Tex>
    </div>
  )
}
