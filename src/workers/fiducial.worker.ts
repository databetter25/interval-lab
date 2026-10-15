/// <reference lib="webworker" />
import { fidCoverage } from '../engine/fiducial'

self.onmessage = (e: MessageEvent<{ key: string; n: number; mu: number; sigma: number; M: number; R: number; level: number; seed: number }>) => {
  const d = e.data
  self.postMessage({ key: d.key, res: fidCoverage(d.n, d.mu, d.sigma, d.M, d.R, d.level, d.seed) })
}
