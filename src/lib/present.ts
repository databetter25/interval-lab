// 강의 모드 (PRD v2 §6.4): 큰 글자, 단계 공개, 단축키.
import { createContext, useContext, useEffect, useRef } from 'react'

export const PresentContext = createContext(false)

export function usePresent() {
  return useContext(PresentContext)
}

/** 강의 모드에서만 동작하는 단축키. 입력 칸에 포커스가 있으면 무시한다 */
export function useShortcuts(map: Record<string, () => void>, enabled: boolean) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key
      const fn = ref.current[key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
