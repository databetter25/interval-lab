/// <reference lib="webworker" />
import { summarize, type GenSpec } from '../engine/repeat'

self.onmessage = (e: MessageEvent<{ id: number; spec: GenSpec; from: number; to: number }>) => {
  const { id, spec, from, to } = e.data
  const every = Math.max(500, Math.floor((to - from) / 40))
  const res = summarize(spec, from, to, (done) => self.postMessage({ id, type: 'progress', done }), every)
  self.postMessage({ id, type: 'done', from: res.from, xbar: res.xbar, s: res.s }, { transfer: [res.xbar.buffer, res.s.buffer] })
}
