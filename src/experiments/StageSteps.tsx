// E02 공개 단계 버튼 (정규·이항 공용)
export function StageSteps({ stage, onStage, labels }: { stage: number; onStage: (n: number) => void; labels: string[] }) {
  return (
    <div className="stage-steps" role="group" aria-label="공개 단계">
      {labels.map((title, i) => {
        const n = i + 1
        return (
          <button key={n} type="button" className={`stage-btn${n < stage ? ' done' : ''}`} aria-current={n === stage ? 'step' : undefined} onClick={() => onStage(n)}>
            <b>{n}단계</b>
            {title}
          </button>
        )
      })}
    </div>
  )
}
