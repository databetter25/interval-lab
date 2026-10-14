// E02·E04 공용 모형 전환: 정규 모평균 / 이항 모비율
import { Segmented } from '../components/ui'
import type { LabState, Update } from '../state/labState'

export function ModelSwitch({ s, update }: { s: LabState; update: Update }) {
  return (
    <div className="model-switch">
      <Segmented<LabState['model']>
        label="모형"
        value={s.model}
        options={[
          { value: 'normal', label: '정규 모평균 (σ 알려짐)' },
          { value: 'binom', label: '이항 모비율' },
        ]}
        onChange={(model) => update({ model, k: 0, sel: -1 })}
      />
    </div>
  )
}
