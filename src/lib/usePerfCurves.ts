// E06 성능 곡선 (PRD v2 AC-E06-5). n이 작으면 바로 계산하고, 크면 Worker에서 계산한다.
import { useEffect, useMemo, useState } from 'react'
import { performanceCurves, type CompareMethod, type Curves, type Prior } from '../engine/binomCompare'

const SYNC_MAX_N = 150

export function usePerfCurves(n: number, level: number, ids: CompareMethod[], prior: Prior): { curves: Record<string, Curves> | null; computing: boolean } {
  const key = `${n}|${level}|${ids.join(',')}|${prior.a}|${prior.b}`
  const sync = n <= SYNC_MAX_N
  const syncCurves = useMemo(() => (sync ? performanceCurves(n, level, ids, prior) : null), [key, sync]) // eslint-disable-line react-hooks/exhaustive-deps
  const [async, setAsync] = useState<{ key: string; curves: Record<string, Curves> } | null>(null)

  useEffect(() => {
    if (sync) return
    const w = new Worker(new URL('../workers/perf.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ curves: Record<string, Curves> }>) => {
      setAsync({ key, curves: e.data.curves })
      w.terminate()
    }
    w.postMessage({ id: 1, n, level, ids, prior })
    return () => w.terminate()
  }, [key, sync]) // eslint-disable-line react-hooks/exhaustive-deps

  if (sync) return { curves: syncCurves, computing: false }
  return async && async.key === key ? { curves: async.curves, computing: false } : { curves: async?.curves ?? null, computing: true }
}
