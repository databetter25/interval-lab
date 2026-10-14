/// <reference lib="webworker" />
import { coverageByN, type Population } from '../engine/robust'

self.onmessage = (e: MessageEvent<{ key: string; pop: Population; level: number; seed: number; B: number }>) => {
  const { key, pop, level, seed, B } = e.data
  self.postMessage({ key, rows: coverageByN(pop, level, seed, B) })
}
