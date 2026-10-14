// xoshiro128** (32비트), splitmix32로 시드 확장. PRD v3 §11.7.
export const RNG_ID = 'xoshiro128ss-v1'

/** splitmix32 한 단계: 상태 a에서 32비트 출력 */
export function splitmix32(a: number): number {
  a = (a + 0x9e3779b9) | 0
  let t = a ^ (a >>> 16)
  t = Math.imul(t, 0x21f0aaad)
  t = t ^ (t >>> 15)
  t = Math.imul(t, 0x735a2d97)
  t = t ^ (t >>> 15)
  return t >>> 0
}

/** 조건 k의 하위 시드: splitmix32(seed ⊕ k) */
export function deriveSeed(seed: number, k: number): number {
  return splitmix32((seed ^ k) >>> 0)
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k))

export class Rng {
  private s0: number
  private s1: number
  private s2: number
  private s3: number
  private spare: number | null = null

  constructor(seed: number) {
    let a = seed >>> 0
    const next = () => {
      a = (a + 0x9e3779b9) >>> 0
      return splitmix32(a)
    }
    this.s0 = next() | 0
    this.s1 = next() | 0
    this.s2 = next() | 0
    this.s3 = next() | 0
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1
  }

  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0
    const t = this.s1 << 9
    this.s2 ^= this.s0
    this.s3 ^= this.s1
    this.s1 ^= this.s2
    this.s0 ^= this.s3
    this.s2 ^= t
    this.s3 = rotl(this.s3, 11)
    return result
  }

  /** u ∈ [0, 1) */
  next(): number {
    return this.nextU32() / 4294967296
  }

  /** 표준정규 (Box–Muller, 두 값을 순서대로 사용) */
  normal(): number {
    if (this.spare !== null) {
      const z = this.spare
      this.spare = null
      return z
    }
    const u1 = 1 - this.next()
    const u2 = this.next()
    const r = Math.sqrt(-2 * Math.log(u1))
    this.spare = r * Math.sin(2 * Math.PI * u2)
    return r * Math.cos(2 * Math.PI * u2)
  }
}

export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}
