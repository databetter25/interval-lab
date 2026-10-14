// 이항 반복표집 x값 캐시. n ≤ 100이라 100,000회도 메인 스레드에서 수십 ms 안에 끝난다.
import { binomReplicates } from '../engine/binomial'

interface Cache {
  key: string
  xs: Uint16Array
  count: number
}

const shared: { cache: Cache | null } = { cache: null }

/** 반복 [0, k)의 x. seed < 0이면 비어 있다 */
export function useBinomReplicates(seed: number, n: number, p: number, k: number): { xs: Uint16Array; count: number } {
  const key = `${seed}|${n}|${p}`
  if (!shared.cache || shared.cache.key !== key) shared.cache = { key, xs: new Uint16Array(0), count: 0 }
  const c = shared.cache
  if (seed >= 0 && c.count < k) {
    const more = binomReplicates(seed, c.count, k, n, p)
    if (c.xs.length < k) {
      const grown = new Uint16Array(Math.max(k, c.xs.length * 2, 1024))
      grown.set(c.xs.subarray(0, c.count))
      c.xs = grown
    }
    c.xs.set(more, c.count)
    c.count = k
  }
  return { xs: c.xs, count: seed >= 0 ? Math.min(c.count, k) : 0 }
}
