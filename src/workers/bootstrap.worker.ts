/// <reference lib="webworker" />
import { bootCoverage, type BootStat } from '../engine/bootstrap'
import type { Population } from '../engine/robust'

self.onmessage = (e: MessageEvent<{ key: string; kind: BootStat; pop: Population; mu: number; sigma: number; n: number; B: number; R: number; level: number; seed: number }>) => {
  const d = e.data
  self.postMessage({ key: d.key, res: bootCoverage(d.kind, d.pop, d.mu, d.sigma, d.n, d.B, d.R, d.level, d.seed) })
}
