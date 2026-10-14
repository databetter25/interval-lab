// E11 반복표집 캐시 (독립·대응). 버튼 한 번에 많아야 1,000회라 메인 스레드에서 계산한다
import { twoSummaries, type TwoRep, type TwoSpec } from '../engine/twoSample'

let cache: { key: string; rep: TwoRep; count: number } | null = null

function grow(a: Float64Array, cap: number, count: number) {
  const out = new Float64Array(cap)
  out.set(a.subarray(0, count))
  return out
}

export function useTwoReplicates(spec: TwoSpec, k: number): { rep: TwoRep; count: number } {
  const key = JSON.stringify(spec)
  if (!cache || cache.key !== key) cache = { key, rep: twoSummaries(spec, 0, 0), count: 0 }
  const c = cache
  if (spec.seed >= 0 && c.count < k) {
    const more = twoSummaries(spec, c.count, k)
    if (c.rep.x1.length < k) {
      const cap = Math.max(k, c.rep.x1.length * 2, 1024)
      c.rep = { x1: grow(c.rep.x1, cap, c.count), s1: grow(c.rep.s1, cap, c.count), x2: grow(c.rep.x2, cap, c.count), s2: grow(c.rep.s2, cap, c.count), sd: grow(c.rep.sd, cap, c.count) }
    }
    for (const f of ['x1', 's1', 'x2', 's2', 'sd'] as const) c.rep[f].set(more[f], c.count)
    c.count = k
  }
  return { rep: c.rep, count: spec.seed >= 0 ? Math.min(c.count, k) : 0 }
}
