// E12 동일꼬리·HPD (PRD v2 E12 수용 기준: 질량 1e−6, HPD 경계 밀도 1e−8), 교재 [예 9.7]·[예 9.8]
import { describe, expect, it } from 'vitest'
import golden from '../golden/golden.json'
import { LOGIT, betaDist, equalTail, gammaDist, hpd, massOf, mixtureDist, normalDist, transformed, type Dist1D } from '../../src/engine/bayesSets'
import { posterior } from '../../src/engine/threeViews'

const g = golden.E12
const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThan(tol)

function checkHpd(d: Dist1D, expected: number[][]) {
  const r = hpd(d, 0.95)
  expect(r.components.length).toBe(expected.length)
  r.components.forEach((c, i) => {
    close(c.lower, expected[i][0], 1e-7)
    close(c.upper, expected[i][1], 1e-7)
  })
  close(r.mass, 0.95, 1e-6)
  // 경계(지지집합 끝이 아닌 곳)에서 밀도가 h와 같다
  for (const c of r.components) for (const e of [c.lower, c.upper]) if (e > d.view[0] && e < d.view[1]) expect(Math.abs(d.pdf(e) - r.h) / r.h).toBeLessThan(1e-8)
  return r
}

describe('교재 예제', () => {
  it('[예 9.7] Beta(4, 8)의 95% 동일꼬리 신용구간 [0.1093, 0.6097]', () => {
    const iv = equalTail(betaDist(4, 8), 0.95)
    close(iv.lower, g.ex97.et[0], 1e-9)
    close(iv.upper, g.ex97.et[1], 1e-9)
    close(iv.lower, 0.1092634, 1e-7)
  })
  it('[예 9.8] 사후 N(10.1898, 0.0999)의 95% HPD [9.5703, 10.8093] = 동일꼬리', () => {
    const post = posterior(10.2, 1, 10, { kind: 'normal', m0: 0, tau0: 10 })
    close(post.mean, g.ex98.mean, 1e-12)
    close(post.variance, g.ex98.variance, 1e-12)
    const d = normalDist(post.mean, post.variance)
    checkHpd(d, [g.ex98.hpd])
    const et = equalTail(d, 0.95)
    close(et.lower, g.ex98.hpd[0], 1e-9)
  })
})

describe('HPD 집합', () => {
  it('치우친 Beta·Gamma: HPD는 동일꼬리보다 짧고 질량은 같다', () => {
    const b = checkHpd(betaDist(4, 8), [g.ex97.hpd])
    expect(b.length).toBeLessThan(g.ex97.et[1] - g.ex97.et[0])
    const gm = checkHpd(gammaDist(4, 4.5), [g.gamma.hpd])
    expect(gm.length).toBeLessThan(g.gamma.et[1] - g.gamma.et[0])
    close(massOf(gammaDist(4, 4.5), [equalTail(gammaDist(4, 4.5), 0.95)]), 0.95, 1e-9)
  })
  it('U자형 Beta(0.4, 0.4): HPD는 양 끝의 두 조각', () => {
    checkHpd(betaDist(0.4, 0.4), g.ubeta.components)
  })
  it('두 봉우리 혼합: HPD는 끊어진 두 구간', () => {
    const m = g.mix
    const r = checkHpd(mixtureDist(m.w, m.m1, m.s1, m.m2, m.s2), m.components)
    close(r.h, m.h, 1e-9)
  })
})

describe('재매개화', () => {
  it('logit 좌표의 HPD를 θ로 되돌리면 θ 좌표의 HPD와 다르다, 동일꼬리는 그대로 옮겨 간다', () => {
    const d = betaDist(4, 8)
    const phi = transformed(d, LOGIT)
    const r = hpd(phi, 0.95)
    expect(r.components.length).toBe(1)
    const back = r.components[0]
    close(LOGIT.ginv(back.lower), g.logitHpd.theta[0], 1e-7)
    close(LOGIT.ginv(back.upper), g.logitHpd.theta[1], 1e-7)
    expect(Math.abs(LOGIT.ginv(back.lower) - g.ex97.hpd[0])).toBeGreaterThan(0.01)
    const etPhi = equalTail(phi, 0.95)
    close(LOGIT.ginv(etPhi.lower), g.ex97.et[0], 1e-8)
    close(LOGIT.ginv(etPhi.upper), g.ex97.et[1], 1e-8)
  })
})
