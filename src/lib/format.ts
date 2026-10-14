// 숫자 표시 규칙 (PRD §9.7 v2 / §8.3 v3): 기본 소수 넷째 자리, 10⁻⁴ 미만은 지수 표기.

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

export function sci(v: number, digits = 3): string {
  if (v === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(v)))
  const m = v / 10 ** e
  const exp = String(e)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('')
  return `${m.toFixed(digits - 1)}×10${exp}`
}

/** 확률 표시 */
export function fmtP(v: number | null | undefined, precise = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (v === 0) return '0'
  if (v === 1) return '1'
  if (Math.abs(v) < 1e-4) return sci(v, precise ? 6 : 3)
  return precise ? v.toPrecision(10) : v.toFixed(4)
}

export function fmtNum(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—'
  const s = v.toFixed(digits)
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}

export function fmtInt(v: number): string {
  return v.toLocaleString('ko-KR')
}

/** 0.05 → "0.05", 0.001 → "0.001" (불필요한 0 제거) */
export function fmtAlpha(a: number): string {
  return String(Number(a.toPrecision(6)))
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 1·2·5 계열의 보기 좋은 간격 (슬라이더 눈금) */
export function niceStep(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v))
  const r = v / mag
  return (r >= 5 ? 5 : r >= 2 ? 2 : 1) * mag
}

/** [F, F, T, T, T, F] → "{2, …, 4}" */
export function formatSet(acc: boolean[]): string {
  const parts: string[] = []
  let start = -1
  for (let k = 0; k <= acc.length; k++) {
    if (k < acc.length && acc[k]) {
      if (start < 0) start = k
    } else if (start >= 0) {
      const end = k - 1
      parts.push(end === start ? `${start}` : end === start + 1 ? `${start}, ${end}` : `${start}, …, ${end}`)
      start = -1
    }
  }
  return parts.length ? `{${parts.join(', ')}}` : '∅'
}
