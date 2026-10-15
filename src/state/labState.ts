// 실험 설정 ↔ URL 쿼리 (PRD v2 §12.3). URL이 단일 진실원이다.
// 설정만 넣고 원자료는 넣지 않는다. 잘못된 값은 기본값으로 되돌린다.
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { splitmix32 } from '../engine/core/rng'
import type { BinomMethod } from '../engine/binomial'
import type { PivotKind } from '../engine/pivot'
import type { Population } from '../engine/robust'
import { COMPARE_METHODS, DEFAULT_COMPARE, type CompareMethod } from '../engine/binomCompare'
import type { Alt, Method } from '../engine/meanInterval'

export const URL_SCHEMA_VERSION = 1

export interface LabState {
  /** 교육용 참값 μ */
  mu: number
  sigma: number
  n: number
  level: number
  method: Method
  alt: Alt
  seed: number
  /** 지금까지 뽑은 반복 수 */
  k: number
  /** "끝까지 실행"의 목표 반복 수 */
  B: number
  /** 그림에 그리는 최근 구간 수 */
  show: number
  /** 선택한 반복 번호 (−1: 없음) */
  sel: number
  /** 관측 x̄ (E02 가로 단면, E04 검정) */
  xbar: number
  /** 가설값 μ₀ */
  mu0: number
  /** E02 공개 단계 1–4 */
  stage: number
  /** 강의용: 참값 숨김 */
  hide: boolean
  /** 강의용 숨김 링크: 참값을 URL에 두지 않고 seed에서 파생 (보안 기능 아님) */
  hm: boolean
  /** 숨김 링크의 중심값 (URL의 mu). 실제 참값 mu = muc + 오프셋(seed) */
  muc: number
  /** E02 모형: 정규평균 / 이항 모비율 */
  model: 'normal' | 'binom'
  /** 이항 시행 수 n */
  bn: number
  /** 이항 관측 x (가로 단면) */
  bx: number
  /** 이항 가설값 p₀ (세로 단면) */
  p0: number
  /** 이항 교육용 참값 p* */
  ps: number
  /** 이항 구간이 뒤집는 검정 */
  bmethod: BinomMethod
  /** 이항: 다른 검정의 띠 겹쳐 보기 */
  cmp: boolean
  /** E06 시행 수 n (1–1000) */
  en: number
  /** E06 비교할 방법들 */
  cm: CompareMethod[]
  /** E06 Beta(a, b) 사전 */
  pa: number
  pb: number
  /** E06 곡선 지표 */
  metric: 'coverage' | 'meanLength' | 'missLeft' | 'missRight'
  /** E07 사전분포: 평탄 / 정규 N(m₀, τ₀²) */
  prior: 'flat' | 'normal'
  m0: number
  tau0: number
  /** E05 목표 오차한계 E */
  me: number
  /** E05 비교 설계 B의 n과 수준 */
  nb: number
  lb: number
  /** E03 피벗 종류 */
  pv: PivotKind
  /** E03 꼬리 배분 α_L/α (0.5 = 등꼬리) */
  ts: number
  /** E03 표본표준편차 S, F의 둘째 표본 */
  sd: number
  n2: number
  sd2: number
  /** E09 모집단과 대상(평균/분산) */
  pop: Population
  tg: 'mean' | 'var'
  /** E10 틀린 값 θ′ */
  th1: number
  /** E10 t 구간(σ 미지) 겹쳐 보기 */
  tc: boolean
  /** E11 설계: 독립 두 평균 / 대응 / 두 비율 */
  de: 'ind' | 'pair' | 'prop'
  mu2: number
  sg2: number
  rho: number
  pp1: number
  pp2: number
  /** E12 사후분포 종류 */
  bf: 'beta' | 'betad' | 'gamma' | 'normal' | 'mix'
  /** E12 Gamma: 사전 shape·rate, 관측 수, 합 */
  ga: number
  gb: number
  pn: number
  gs: number
  /** E12 혼합 봉우리 간격 */
  md: number
  /** E12 재매개화 좌표로 보기 */
  rp: boolean
  /** E13 관측 최댓값 M, 표본크기, 구간을 정하는 b(−1 = 중앙), 교육용 θ */
  mo: number
  un: number
  bs: number
  th: number
  /** E14 부트스트랩: 통계량, 재표집 수 B, 표본 번호 */
  bst: 'mean' | 'median' | 'var'
  bb: number
  bsi: number
  /** E08 허용구간: 덮을 비율 β, 신뢰수준 γ, 양측/단측(상한) */
  tb: number
  tgm: number
  tsd: 'two' | 'one'
  /** E10 손실함수: 길이 1당 비용 b */
  lc: number
  /** E15 일반화 피듀셜: 로그 척도 μ, σ, 표본 번호, GPQ 뽑기 수 */
  fm: number
  fs: number
  fi: number
  fg: number
}

export const DEFAULTS: LabState = {
  mu: 100,
  sigma: 25,
  n: 25,
  level: 0.95,
  method: 'z',
  alt: 'two',
  /** −1: 아직 정하지 않음. 처음 표본을 뽑을 때 무작위로 정해 URL에 남긴다 */
  seed: -1,
  k: 0,
  B: 1000,
  show: 100,
  sel: -1,
  xbar: 100,
  mu0: 100,
  stage: 1,
  hide: false,
  hm: false,
  muc: 100,
  model: 'normal',
  bn: 10,
  bx: 3,
  p0: 0.3,
  ps: 0.3,
  bmethod: 'cp',
  cmp: false,
  en: 10,
  cm: DEFAULT_COMPARE,
  pa: 1,
  pb: 1,
  metric: 'coverage',
  prior: 'flat',
  m0: 90,
  tau0: 10,
  me: 5,
  nb: 100,
  lb: 0.95,
  pv: 'z',
  ts: 0.5,
  sd: 20,
  n2: 8,
  sd2: 1.5,
  pop: 'exp',
  tg: 'mean',
  th1: 90,
  tc: false,
  de: 'ind',
  mu2: 100,
  sg2: 25,
  rho: 0.6,
  pp1: 0.3,
  pp2: 0.2,
  bf: 'beta',
  ga: 1,
  gb: 0.5,
  pn: 4,
  gs: 3,
  md: 3.3,
  rp: false,
  mo: 0.9,
  un: 5,
  bs: -1,
  th: 1,
  bst: 'mean',
  bb: 2000,
  bsi: 0,
  tb: 0.9,
  tgm: 0.95,
  tsd: 'two',
  lc: 0.0117,
  fm: 0,
  fs: 1,
  fi: 0,
  fg: 5000,
}

export const LIMITS = {
  mu: [-1e6, 1e6],
  sigma: [1e-6, 1e6],
  n: [2, 1000],
  level: [0.5, 0.999],
  k: [0, 100_000],
  B: [1, 100_000],
  show: [20, 200],
  stage: [1, 4],
  bn: [1, 100],
  bx: [0, 100],
  p0: [0, 1],
  ps: [0, 1],
  en: [1, 1000],
  pa: [0.01, 100],
  pb: [0.01, 100],
  m0: [-1e6, 1e6],
  tau0: [0.01, 1e6],
  me: [1e-6, 1e6],
  nb: [2, 1000],
  lb: [0.5, 0.999],
  ts: [0, 1],
  sd: [1e-6, 1e6],
  n2: [2, 1000],
  sd2: [1e-6, 1e6],
  mu2: [-1e6, 1e6],
  sg2: [1e-6, 1e6],
  rho: [-0.99, 0.99],
  pp1: [0, 1],
  pp2: [0, 1],
  ga: [0.01, 1000],
  gb: [0.01, 1000],
  pn: [0, 10000],
  gs: [0, 1e6],
  md: [0, 20],
  mo: [1e-9, 1e9],
  un: [1, 1000],
  bs: [-1, 1],
  th: [1e-9, 1e9],
  bb: [100, 20000],
  bsi: [0, 1e6],
  tb: [0.5, 0.999],
  tgm: [0.5, 0.999],
  lc: [1e-6, 100],
  fm: [-5, 5],
  fs: [0.1, 3],
  fi: [0, 1e6],
  fg: [500, 20000],
} as const

type NumKey = 'mu' | 'sigma' | 'n' | 'level' | 'k' | 'B' | 'show' | 'stage' | 'sel' | 'xbar' | 'mu0' | 'seed' | 'bn' | 'bx' | 'p0' | 'ps' | 'en' | 'pa' | 'pb' | 'm0' | 'tau0' | 'me' | 'nb' | 'lb' | 'ts' | 'sd' | 'n2' | 'sd2' | 'th1' | 'mu2' | 'sg2' | 'rho' | 'pp1' | 'pp2' | 'ga' | 'gb' | 'pn' | 'gs' | 'md' | 'mo' | 'un' | 'bs' | 'th' | 'bb' | 'bsi' | 'tb' | 'tgm' | 'lc' | 'fm' | 'fs' | 'fi' | 'fg'
const INT_KEYS = new Set<NumKey>(['n', 'k', 'B', 'show', 'stage', 'sel', 'seed', 'bn', 'bx', 'en', 'nb', 'n2', 'pn', 'un', 'bb', 'bsi', 'fi', 'fg'])

function readNum(p: URLSearchParams, key: NumKey): number {
  const raw = p.get(key)
  const fallback = DEFAULTS[key]
  if (raw === null || raw.trim() === '') return fallback
  const v = Number(raw)
  if (!Number.isFinite(v)) return fallback
  if (INT_KEYS.has(key) && !Number.isInteger(v)) return fallback
  const lim = (LIMITS as Record<string, readonly [number, number]>)[key]
  if (lim && (v < lim[0] || v > lim[1])) return fallback
  if (key === 'seed' && (v < -1 || v > 0xffffffff)) return fallback
  if (key === 'sel' && v < -1) return fallback
  return v
}

const METRICS: LabState['metric'][] = ['coverage', 'meanLength', 'missLeft', 'missRight']
const METHOD_IDS = new Set(COMPARE_METHODS.map((m) => m.id))

/** "wald,cp" → ['wald', 'cp']. 순서는 COMPARE_METHODS를 따르고, 모르는 값은 버린다 */
function parseMethods(raw: string | null): CompareMethod[] {
  if (raw === null) return DEFAULTS.cm
  const want = new Set(raw.split(',').filter((v) => METHOD_IDS.has(v as CompareMethod)))
  const out = COMPARE_METHODS.map((m) => m.id).filter((id) => want.has(id))
  return out.length ? out : DEFAULTS.cm
}

/** 숨김 링크의 참값 오프셋: seed로 정한 [−1.5σ, 1.5σ] 안의 값 (σ/10 단위로 반올림) */
export function hiddenOffset(seed: number, sigma: number): number {
  const u = splitmix32((seed ^ 0x68696465) >>> 0) / 4294967296
  return (Math.round((2 * u - 1) * 15) / 10) * sigma
}

export function parseState(p: URLSearchParams): LabState {
  const method = p.get('method')
  const alt = p.get('alt')
  const model = p.get('model')
  const bmethod = p.get('bmethod')
  const s: LabState = {
    mu: readNum(p, 'mu'),
    sigma: readNum(p, 'sigma'),
    n: readNum(p, 'n'),
    level: readNum(p, 'level'),
    method: method === 't' || method === 'z' ? method : DEFAULTS.method,
    alt: alt === 'two' || alt === 'greater' || alt === 'less' ? alt : DEFAULTS.alt,
    seed: readNum(p, 'seed'),
    k: readNum(p, 'k'),
    B: readNum(p, 'B'),
    show: readNum(p, 'show'),
    sel: readNum(p, 'sel'),
    xbar: readNum(p, 'xbar'),
    mu0: readNum(p, 'mu0'),
    stage: readNum(p, 'stage'),
    hide: p.get('hide') === '1',
    hm: p.get('hm') === '1',
    muc: DEFAULTS.muc,
    model: model === 'binom' || model === 'normal' ? model : DEFAULTS.model,
    bn: readNum(p, 'bn'),
    bx: readNum(p, 'bx'),
    p0: readNum(p, 'p0'),
    ps: readNum(p, 'ps'),
    cmp: p.get('cmp') === '1',
    en: readNum(p, 'en'),
    cm: parseMethods(p.get('cm')),
    prior: p.get('prior') === 'normal' ? 'normal' : 'flat',
    pv: (['z', 't', 'chi2', 'f'] as const).includes(p.get('pv') as PivotKind) ? (p.get('pv') as PivotKind) : DEFAULTS.pv,
    pop: (['normal', 'exp', 'lnorm', 't3'] as const).includes(p.get('pop') as Population) ? (p.get('pop') as Population) : DEFAULTS.pop,
    tg: p.get('tg') === 'var' ? 'var' : 'mean',
    th1: readNum(p, 'th1'),
    de: p.get('de') === 'pair' || p.get('de') === 'prop' ? (p.get('de') as 'pair' | 'prop') : 'ind',
    mu2: readNum(p, 'mu2'),
    sg2: readNum(p, 'sg2'),
    rho: readNum(p, 'rho'),
    bf: (['beta', 'betad', 'gamma', 'normal', 'mix'] as const).includes(p.get('bf') as LabState['bf']) ? (p.get('bf') as LabState['bf']) : DEFAULTS.bf,
    ga: readNum(p, 'ga'),
    gb: readNum(p, 'gb'),
    pn: readNum(p, 'pn'),
    gs: readNum(p, 'gs'),
    md: readNum(p, 'md'),
    rp: p.get('rp') === '1',
    mo: readNum(p, 'mo'),
    un: readNum(p, 'un'),
    bs: readNum(p, 'bs'),
    th: readNum(p, 'th'),
    bst: p.get('bst') === 'median' || p.get('bst') === 'var' ? (p.get('bst') as 'median' | 'var') : 'mean',
    bb: readNum(p, 'bb'),
    bsi: readNum(p, 'bsi'),
    tb: readNum(p, 'tb'),
    lc: readNum(p, 'lc'),
    fm: readNum(p, 'fm'),
    fs: readNum(p, 'fs'),
    fi: readNum(p, 'fi'),
    fg: readNum(p, 'fg'),
    tgm: readNum(p, 'tgm'),
    tsd: p.get('tsd') === 'one' ? 'one' : 'two',
    pp1: readNum(p, 'pp1'),
    pp2: readNum(p, 'pp2'),
    tc: p.get('tc') === '1',
    ts: readNum(p, 'ts'),
    sd: readNum(p, 'sd'),
    n2: readNum(p, 'n2'),
    sd2: readNum(p, 'sd2'),
    me: readNum(p, 'me'),
    nb: readNum(p, 'nb'),
    lb: readNum(p, 'lb'),
    m0: readNum(p, 'm0'),
    tau0: readNum(p, 'tau0'),
    pa: readNum(p, 'pa'),
    pb: readNum(p, 'pb'),
    metric: METRICS.includes(p.get('metric') as LabState['metric']) ? (p.get('metric') as LabState['metric']) : DEFAULTS.metric,
    bmethod: bmethod === 'cp' || bmethod === 'wilson' || bmethod === 'wald' ? bmethod : DEFAULTS.bmethod,
  }
  if (s.sel >= s.k) s.sel = -1
  if (s.bx > s.bn) s.bx = s.bn
  s.muc = s.mu
  if (s.hm && s.seed >= 0) s.mu = s.muc + hiddenOffset(s.seed, s.sigma)
  return s
}

/** 기본값과 다른 항목만 쓴다 */
export function serializeState(s: LabState): URLSearchParams {
  const p = new URLSearchParams()
  p.set('v', String(URL_SCHEMA_VERSION))
  for (const key of Object.keys(DEFAULTS) as (keyof LabState)[]) {
    // 숨김 링크에서는 파생된 참값 대신 중심값을 쓴다
    const v = key === 'mu' && s.hm ? s.muc : s[key]
    if (key === 'muc') continue
    if (key === 'cm') {
      const list = (v as CompareMethod[]).join(',')
      if (list !== DEFAULTS.cm.join(',')) p.set('cm', list)
      continue
    }
    if (v === DEFAULTS[key]) continue
    if (key === 'hide' || key === 'cmp' || key === 'tc' || key === 'rp' || key === 'hm') p.set(key, '1')
    else p.set(key, String(v))
  }
  return p
}

/** 생성 조건이 바뀌면 이미 뽑은 표본은 무효다 (재표집) */
export function generationKey(s: Pick<LabState, 'mu' | 'sigma' | 'n' | 'seed'> & Partial<Pick<LabState, 'model' | 'bn' | 'ps' | 'en'>>): string {
  const binom = s.model === 'binom' ? `|binom|${s.bn}|${s.ps}` : ''
  // E06은 en·ps로 이항 표본을 만든다
  const e06 = s.en !== undefined ? `|e06|${s.en}` : ''
  return `${s.mu}|${s.sigma}|${s.n}|${s.seed}${binom}${e06}`
}

/** 바뀔 값, 또는 지금 상태에서 바뀔 값을 계산하는 함수 (빠른 연속 입력에서도 최신 상태를 쓴다) */
export type Patch = Partial<LabState> | ((cur: LabState) => Partial<LabState>)
export type Update = (patch: Patch) => void

export function useLabState(): [LabState, Update] {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseState(params), [params])
  const update = useCallback<Update>(
    (patch) => {
      setParams(
        (prev) => {
          // react-router의 prev는 마지막 렌더 시점 값이라, 렌더 전에 연달아 부르면 옛 값이 된다.
          // HashRouter는 주소를 즉시 바꾸므로 실제 주소에서 최신 상태를 읽는다.
          const hash = typeof window !== 'undefined' ? window.location.hash : ''
          const q = hash.indexOf('?')
          const cur = parseState(q >= 0 ? new URLSearchParams(hash.slice(q + 1)) : prev)
          const p = typeof patch === 'function' ? patch(cur) : patch
          const next = { ...cur, ...p }
          // 생성 조건이 바뀌면 뽑은 표본과 선택을 비운다
          if (generationKey(next) !== generationKey(cur) && p.k === undefined) {
            next.k = 0
            next.sel = -1
          }
          return serializeState(next)
        },
        { replace: true },
      )
    },
    [setParams],
  )
  return [state, update]
}
