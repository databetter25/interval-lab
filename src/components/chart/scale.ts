export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  const f = (v: number) => r0 + (v - d0) * k
  f.invert = (p: number) => (k === 0 ? d0 : d0 + (p - r0) / k)
  return f
}

/** 보기 좋은 눈금 */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (hi <= lo) return [lo]
  const span = hi - lo
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const err = step0 / mag
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag
  const start = Math.ceil(lo / step - 1e-9) * step
  const out: number[] = []
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

export function fmtTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString('ko-KR')
  const s = String(Number(v.toPrecision(6)))
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}
