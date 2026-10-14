/// <reference lib="webworker" />
import { performanceCurves, type CompareMethod, type Prior } from '../engine/binomCompare'

self.onmessage = (e: MessageEvent<{ id: number; n: number; level: number; ids: CompareMethod[]; prior: Prior }>) => {
  const { id, n, level, ids, prior } = e.data
  self.postMessage({ id, curves: performanceCurves(n, level, ids, prior) })
}
