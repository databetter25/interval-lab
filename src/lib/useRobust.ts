// E09 훅: 현재 n의 반복표집(캐시, 메인 스레드)과 표본크기별 포함률(Worker)
import { useEffect, useState } from 'react'
import { coverageByN, popSummaries, type Population, type PopSpec } from '../engine/robust'

interface Cache {
  key: string
  xbar: Float64Array
  s: Float64Array
  count: number
}
let cache: Cache | null = null

/** 반복 [0, k)의 x̄·S. 버튼 한 번에 많아야 1,000회라 메인 스레드에서 바로 계산한다 */
export function usePopReplicates(spec: PopSpec, k: number): { xbar: Float64Array; s: Float64Array; count: number } {
  const key = `${spec.pop}|${spec.mu}|${spec.sigma}|${spec.n}|${spec.seed}`
  if (!cache || cache.key !== key) cache = { key, xbar: new Float64Array(0), s: new Float64Array(0), count: 0 }
  const c = cache
  if (spec.seed >= 0 && c.count < k) {
    const more = popSummaries(spec, c.count, k)
    if (c.xbar.length < k) {
      const cap = Math.max(k, c.xbar.length * 2, 1024)
      const nx = new Float64Array(cap)
      const ns = new Float64Array(cap)
      nx.set(c.xbar.subarray(0, c.count))
      ns.set(c.s.subarray(0, c.count))
      c.xbar = nx
      c.s = ns
    }
    c.xbar.set(more.xbar, c.count)
    c.s.set(more.s, c.count)
    c.count = k
  }
  return { xbar: c.xbar, s: c.s, count: spec.seed >= 0 ? Math.min(c.count, k) : 0 }
}

export type CoverageRows = ReturnType<typeof coverageByN>

/** 표본크기별 포함률. 고정 seed라 같은 설정이면 언제나 같은 곡선이 나온다 */
export const COVERAGE_SEED = 20261015
export const COVERAGE_B = 20_000

export function useCoverageByN(pop: Population, level: number): { rows: CoverageRows | null; computing: boolean } {
  const key = `${pop}|${level}`
  const [res, setRes] = useState<{ key: string; rows: CoverageRows } | null>(null)
  useEffect(() => {
    const w = new Worker(new URL('../workers/robust.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ key: string; rows: CoverageRows }>) => {
      setRes({ key: e.data.key, rows: e.data.rows })
      w.terminate()
    }
    w.postMessage({ key, pop, level, seed: COVERAGE_SEED, B: COVERAGE_B })
    return () => w.terminate()
  }, [key, pop, level])
  return res && res.key === key ? { rows: res.rows, computing: false } : { rows: res?.rows ?? null, computing: true }
}
