// 반복표집 요약값(x̄, S) 캐시. 작은 요청은 바로 계산하고, 큰 요청은 Worker에서 계산한다 (PRD v2 §12.2).
// 생성 조건(μ, σ, n, seed)이 같으면 E01·E02가 같은 캐시를 공유한다.
import { useEffect, useRef, useState } from 'react'
import { summarize, type GenSpec } from '../engine/repeat'

/** 이 정도(정규 난수 개수) 이하는 메인 스레드에서 바로 계산 */
const SYNC_LIMIT = 200_000

interface Cache {
  key: string
  xbar: Float64Array
  s: Float64Array
  count: number
}

/** 생성 조건별 캐시. E05처럼 두 설계를 함께 볼 수 있도록 최근 4개를 둔다 */
const caches = new Map<string, Cache>()
const MAX_CACHES = 4

function cacheFor(key: string): Cache {
  let c = caches.get(key)
  if (c) {
    caches.delete(key)
  } else {
    c = { key, xbar: new Float64Array(0), s: new Float64Array(0), count: 0 }
    if (caches.size >= MAX_CACHES) caches.delete(caches.keys().next().value!)
  }
  caches.set(key, c)
  return c
}

function keyOf(g: GenSpec) {
  return `${g.mu}|${g.sigma}|${g.n}|${g.seed}`
}

function append(c: Cache, from: number, xbar: Float64Array, s: Float64Array) {
  if (from !== c.count) return
  const need = c.count + xbar.length
  if (need > c.xbar.length) {
    const cap = Math.max(need, c.xbar.length * 2, 1024)
    const nx = new Float64Array(cap)
    const ns = new Float64Array(cap)
    nx.set(c.xbar.subarray(0, c.count))
    ns.set(c.s.subarray(0, c.count))
    c.xbar = nx
    c.s = ns
  }
  c.xbar.set(xbar, c.count)
  c.s.set(s, c.count)
  c.count = need
}

export interface Replicates {
  /** 앞에서부터 count개가 유효 */
  xbar: Float64Array
  s: Float64Array
  count: number
  running: boolean
  progress: number
  /** 계산을 멈추고, 지금까지 계산된 반복 수를 돌려준다 */
  cancel: () => number
}

/** 반복 [0, k)의 요약값. seed < 0이면 아무것도 계산하지 않는다 */
export function useReplicates(gen: GenSpec, k: number): Replicates {
  const { mu, sigma, n, seed } = gen
  const key = keyOf(gen)
  const [, setVersion] = useState(0)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const workerRef = useRef<Worker | null>(null)

  const cache = cacheFor(key)

  // 작은 요청은 렌더링 중에 바로 채운다 (Worker 왕복 지연 없이 1회·10회 버튼이 반응)
  if (seed >= 0 && cache.count < k && (k - cache.count) * n <= SYNC_LIMIT && !running) {
    const from = cache.count
    const r = summarize({ mu, sigma, n, seed }, from, k)
    append(cache, from, r.xbar, r.s)
  }

  useEffect(() => {
    if (seed < 0 || cache.count >= k || workerRef.current) return
    const from = cache.count
    const w = new Worker(new URL('../workers/replicates.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    setRunning(true)
    setProgress(0)
    w.onmessage = (e: MessageEvent<{ type: string; done?: number; from?: number; xbar?: Float64Array; s?: Float64Array }>) => {
      if (e.data.type === 'progress') setProgress((e.data.done ?? 0) / (k - from))
      else if (e.data.type === 'done') {
        const c = caches.get(key)
        if (c) append(c, e.data.from!, e.data.xbar!, e.data.s!)
        w.terminate()
        workerRef.current = null
        setRunning(false)
        setProgress(1)
        setVersion((v) => v + 1)
      }
    }
    w.onerror = (err) => {
      console.error('반복표집 Worker 오류', err.message)
      w.terminate()
      workerRef.current = null
      setRunning(false)
    }
    w.postMessage({ id: 1, spec: { mu, sigma, n, seed }, from, to: k })
    return () => {
      w.terminate()
      if (workerRef.current === w) workerRef.current = null
      setRunning(false)
    }
  }, [key, k, cache, mu, sigma, n, seed])

  const cancel = () => {
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(false)
    return Math.min(cache.count, k)
  }

  return { xbar: cache.xbar, s: cache.s, count: Math.min(cache.count, k), running, progress, cancel }
}
