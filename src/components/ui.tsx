import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/** KaTeX 수식 */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(children, { displayMode: block, throwOnError: false, output: 'htmlAndMathml' }), [children, block])
  const ref = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)
  // 가로로 넘치는 수식만 키보드로 스크롤할 수 있게 포커스를 준다 (WCAG: scrollable-region-focusable)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1)
    check()
    // KaTeX 글꼴이 늦게 로드되면 내용만 넓어지고 상자 크기는 그대로라, 내용 요소도 함께 관찰한다
    const ro = new ResizeObserver(check)
    ro.observe(el)
    const inner = el.querySelector('.katex-display, .katex')
    if (inner) ro.observe(inner)
    let alive = true
    document.fonts?.ready.then(() => alive && check())
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [html])
  if (!block) return <span dangerouslySetInnerHTML={{ __html: html }} />
  return <div ref={ref} className="tex-block" dangerouslySetInnerHTML={{ __html: html }} {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-label': '수식 (가로로 스크롤)' } : {})} />
}

/** 교재 위치 배지 (PRD §4.1) */
export function TextbookBadge({ children }: { children: ReactNode }) {
  return (
    <span className="textbook-badge" title="『통계학의 개념 및 제문제』 위치">
      📘 {children}
    </span>
  )
}

interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: string
  disabled?: boolean
  disabledReason?: string
}

/** 슬라이더 + 숫자 입력. 숫자 입력은 범위 밖 값을 잘라낸다 */
export function SliderField({ label, value, min, max, step, onChange, format, hint, disabled, disabledReason }: SliderProps) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  const commit = (s: string) => {
    const v = Number(s)
    if (!Number.isFinite(v)) {
      setDraft(String(value))
      return
    }
    const snapped = Math.round((Math.min(max, Math.max(min, v)) - min) / step) * step + min
    const fixed = Number(snapped.toFixed(10))
    onChange(fixed)
    setDraft(String(fixed))
  }
  return (
    <div className="field" title={disabled ? disabledReason : undefined}>
      <label className="field-label">
        <span>{label}</span>
        <output>{format ? format(value) : value}</output>
      </label>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={typeof label === 'string' ? label : undefined} />
        <input
          className="num-input"
          style={{ width: 84, flex: 'none' }}
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          aria-label={`${typeof label === 'string' ? label : '값'} 직접 입력`}
        />
      </div>
      {disabled && disabledReason ? <span className="field-hint">{disabledReason}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="tab-nav" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`tab-btn${value === o.value ? ' active' : ''}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface Stat {
  tag: string
  label: ReactNode
  value: string
  sub?: string
  tone?: 'blue' | 'orange'
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats-row" aria-live="polite">
      {stats.map((s, i) => (
        <div className="stat-box" key={i}>
          <div className="stat-tag">{s.tag}</div>
          <div className="stat-label">{s.label}</div>
          <div className={`stat-num ${s.tone ?? ''}`}>{s.value}</div>
          {s.sub && <div className="stat-sub">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function Fold({ title, children, open = false }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="fold" open={open}>
      <summary>{title}</summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

export function Legend({ items }: { items: { color: string; label: string; pattern?: 'hatch' | 'dots' | 'line' | 'fill' }[] }) {
  return (
    <div className="chart-legend">
      {items.map((it) => (
        <span key={it.label}>
          <span
            className="legend-swatch"
            style={
              it.pattern === 'hatch'
                ? { background: `repeating-linear-gradient(45deg, ${it.color} 0 2px, transparent 2px 5px)` }
                : it.pattern === 'dots'
                  ? { background: `radial-gradient(${it.color} 1px, transparent 1.2px) 0 0/4px 4px` }
                  : it.pattern === 'line'
                    ? { background: 'transparent', borderTop: `2px dashed ${it.color}`, height: 0, marginBottom: 3 }
                    : it.pattern === 'fill'
                      ? { background: it.color }
                      : { background: 'transparent', border: `1.5px solid ${it.color}` }
            }
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}
