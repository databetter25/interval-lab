// 설정 JSON, 결과 CSV, R 코드 (PRD v2 §12.4–12.5). DOM에 의존하지 않는 순수 함수.
import { binomInterval } from '../engine/binomial'
import { COMPARE_METHODS, compareBelt, type Curves } from '../engine/binomCompare'
import { RNG_ID } from '../engine/core/rng'
import { ENGINE_VERSION, NORMAL_TRANSFORM, missSide, replicateInterval, type RepMethod } from '../engine/repeat'
import { URL_SCHEMA_VERSION, parseState, serializeState, type LabState } from '../state/labState'

export const SETTINGS_SCHEMA_VERSION = 1

export interface SettingsJson {
  schema_version: number
  experiment_id: string
  model: 'normal-mean' | 'binomial'
  estimand: 'mu' | 'p'
  generation_parameters: { mu: number; sigma: number; n: number } | { p: number; n: number }
  observed_summary: { xbar: number; mu0: number } | { x: number; p0: number }
  method_ids: string[]
  confidence_level: number
  tails: { alt: LabState['alt']; alpha_L: number; alpha_U: number }
  prior: null | { family: 'beta'; a: number; b: number }
  boundary_policy: string | null
  replicate_count: number
  target_replicates: number
  seed: number | null
  rng_algorithm: string
  normal_transform: string
  engine_version: string
  url_schema_version: number
  url_state: string
  created_at: string
}

export function tailsOf(s: Pick<LabState, 'alt' | 'level'>) {
  const a = 1 - s.level
  if (s.alt === 'greater') return { alt: s.alt, alpha_L: 0, alpha_U: a }
  if (s.alt === 'less') return { alt: s.alt, alpha_L: a, alpha_U: 0 }
  return { alt: s.alt, alpha_L: a / 2, alpha_U: a / 2 }
}

export function methodId(method: LabState['method']) {
  return method === 'z' ? 'normal_mean_z' : 'normal_mean_t'
}

export function binomMethodId(m: LabState['bmethod']) {
  return `binom_${m}`
}

/** E02 이항 모형인가 */
export const isBinom = (s: LabState, experimentId: string) => experimentId === 'E06' || ((experimentId === 'E02' || experimentId === 'E04') && s.model === 'binom')

export function settingsJson(s: LabState, experimentId: string, now = new Date()): SettingsJson {
  const binom = isBinom(s, experimentId)
  const e06 = experimentId === 'E06'
  return {
    schema_version: SETTINGS_SCHEMA_VERSION,
    experiment_id: experimentId,
    model: binom ? 'binomial' : 'normal-mean',
    estimand: binom ? 'p' : 'mu',
    generation_parameters: binom ? { p: s.ps, n: e06 ? s.en : s.bn } : { mu: s.mu, sigma: s.sigma, n: s.n },
    observed_summary: binom ? { x: Math.min(s.bx, e06 ? s.en : s.bn), p0: s.p0 } : { xbar: s.xbar, mu0: s.mu0 },
    method_ids: e06 ? s.cm.map((m) => `binom_${m}`) : [binom ? binomMethodId(s.bmethod) : methodId(s.method)],
    confidence_level: s.level,
    tails: binom ? { alt: 'two', alpha_L: (1 - s.level) / 2, alpha_U: (1 - s.level) / 2 } : tailsOf(s),
    prior: e06 && s.cm.includes('bayes_beta') ? { family: 'beta' as const, a: s.pa, b: s.pb } : null,
    boundary_policy: e06 ? s.cm.map((m) => `${m}: ${COMPARE_METHODS.find((c) => c.id === m)!.basis}`).join(' | ') : binom ? (s.bmethod === 'cp' ? 'cp: x=0 → L=0, x=n → U=1' : s.bmethod === 'wald' ? 'wald: 미수정 (잘라내지 않음)' : 'wilson: 미수정') : null,
    replicate_count: s.k,
    target_replicates: s.B,
    seed: s.seed >= 0 ? s.seed : null,
    rng_algorithm: RNG_ID,
    normal_transform: NORMAL_TRANSFORM,
    engine_version: ENGINE_VERSION,
    url_schema_version: URL_SCHEMA_VERSION,
    url_state: serializeState(s).toString(),
    created_at: now.toISOString(),
  }
}

/** 불러온 설정 JSON → 상태. 형식이 맞지 않으면 null */
export function stateFromSettings(raw: unknown): LabState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<SettingsJson>
  if (o.schema_version !== SETTINGS_SCHEMA_VERSION || typeof o.url_state !== 'string') return null
  return parseState(new URLSearchParams(o.url_state))
}

export const CSV_FIELDS = ['replicate_id', 'method_id', 'estimate', 'se', 'lower', 'upper', 'components', 'contains_truth', 'miss_side', 'width', 'posterior_mass', 'status'] as const

const num = (v: number) => (Number.isFinite(v) ? String(v) : v > 0 ? 'Inf' : v < 0 ? '-Inf' : '')

/** 반복마다 한 행. 해당 없는 값은 빈칸 (0을 넣지 않는다) */
export function replicatesCsv(s: LabState, sum: { xbar: ArrayLike<number>; s: ArrayLike<number> }, count: number, experimentId: string): string {
  const rm: RepMethod = { method: s.method, level: s.level, alt: s.alt, sigma: s.sigma, n: s.n }
  const meta = [
    `# Interval Lab ${experimentId} 결과`,
    `# 설정: ${serializeState(s).toString()}`,
    `# seed=${s.seed} rng=${RNG_ID} normal=${NORMAL_TRANSFORM} engine=${ENGINE_VERSION}`,
    `# 참값 μ=${s.mu}는 교육용으로 정한 생성 조건입니다. 유효 반복 ${count} / 실패 0`,
  ]
  const rows: string[] = [CSV_FIELDS.join(',')]
  const id = methodId(s.method)
  for (let b = 0; b < count; b++) {
    const xb = sum.xbar[b]
    const sd = s.method === 'z' ? s.sigma : sum.s[b]
    const iv = replicateInterval(rm, xb, sum.s[b])
    const side = missSide(iv, s.mu)
    rows.push([b + 1, id, num(xb), num(sd / Math.sqrt(s.n)), num(iv.lower), num(iv.upper), '', side === 'none' ? 1 : 0, side, num(iv.upper - iv.lower), '', 'ok'].join(','))
  }
  return meta.join('\n') + '\n' + rows.join('\n') + '\n'
}

/** 교재 8.8 [프로그램 8.1] 형식의 base R 코드. R의 난수는 사이트와 다르므로 구간 값은 같지 않다 */
export function rCode(s: LabState): string {
  const B = Math.max(1, s.k || s.B)
  const lv = s.level
  const ciLine =
    s.method === 't'
      ? `ci <- apply(data, 2, function(x) t.test(x, conf.level = level${s.alt === 'two' ? '' : `, alternative = "${s.alt}"`})$conf.int)`
      : s.alt === 'two'
        ? `q <- qnorm(1 - (1 - level) / 2)\nci <- apply(data, 2, function(x) mean(x) + c(-1, 1) * q * sigma / sqrt(n))`
        : s.alt === 'greater'
          ? `q <- qnorm(level)\nci <- apply(data, 2, function(x) c(mean(x) - q * sigma / sqrt(n), Inf))`
          : `q <- qnorm(level)\nci <- apply(data, 2, function(x) c(-Inf, mean(x) + q * sigma / sqrt(n)))`
  return `# Interval Lab E01 — 반복표집으로 본 신뢰구간 (교재 8.8 [프로그램 8.1] 형식)
# 사이트 설정: ${serializeState(s).toString()}
# 주의: R의 난수 생성기는 사이트(${RNG_ID})와 달라서, 같은 seed라도 구간 값은 다릅니다.
#       설정(모집단·n·방법·수준·반복 수)이 같으므로 포함률은 같은 분포를 따릅니다.
set.seed(${s.seed >= 0 ? s.seed % 2147483647 : 1})
B <- ${B}; n <- ${s.n}; mu <- ${s.mu}; sigma <- ${s.sigma}; level <- ${lv}
data <- matrix(rnorm(B * n, mu, sigma), n)
${ciLine}
covered <- ci[1, ] <= mu & mu <= ci[2, ]
cat("포함:", sum(covered), "/", B, " 경험적 포함률:", mean(covered), "\\n")

shown <- max(1, B - 99):B
plot(range(ci[, shown][is.finite(ci[, shown])], mu), c(min(shown), max(shown)), type = "n", xlab = "구간", ylab = "반복")
for (i in shown) lines(ci[, i], rep(i, 2), lwd = ifelse(covered[i], 1, 2), col = ifelse(covered[i], 4, 2))
abline(v = mu, lwd = 2, lty = 2)
`
}


/** 이항 반복표집 결과. 같은 x는 같은 구간이다 */
export function binomCsv(s: LabState, xs: ArrayLike<number>, count: number): string {
  const meta = [
    '# Interval Lab E02 이항 신뢰띠 결과',
    `# 설정: ${serializeState(s).toString()}`,
    `# seed=${s.seed} rng=${RNG_ID} bernoulli=uniform<p engine=${ENGINE_VERSION}`,
    `# 참값 p*=${s.ps}는 교육용으로 정한 생성 조건입니다. 유효 반복 ${count} / 실패 0`,
  ]
  const id = binomMethodId(s.bmethod)
  const belt = Array.from({ length: s.bn + 1 }, (_, x) => binomInterval(x, s.bn, s.level, s.bmethod))
  const rows: string[] = [CSV_FIELDS.join(',')]
  for (let b = 0; b < count; b++) {
    const x = xs[b]
    const iv = belt[x]
    const side = iv.lower <= s.ps && s.ps <= iv.upper ? 'none' : iv.lower > s.ps ? 'left' : 'right'
    rows.push([b + 1, id, x / s.bn, '', iv.lower, iv.upper, '', side === 'none' ? 1 : 0, side, iv.upper - iv.lower, '', 'ok'].join(','))
  }
  return meta.join('\n') + '\n' + rows.join('\n') + '\n'
}

/** E06: 반복마다·방법마다 한 행 (경계 변형도 별도 method_id로 남는다, AC-E06-4) */
export function compareCsv(s: LabState, xs: ArrayLike<number>, count: number): string {
  const n = s.en
  const meta = [
    '# Interval Lab E06 이항구간 비교 — 반복표집 결과',
    `# 설정: ${serializeState(s).toString()}`,
    `# seed=${s.seed} rng=${RNG_ID} bernoulli=uniform<p engine=${ENGINE_VERSION}`,
    `# 참값 p*=${s.ps}는 교육용으로 정한 생성 조건입니다. 유효 반복 ${count} / 실패 0`,
  ]
  const belts = s.cm.map((m) => ({ id: `binom_${m}`, belt: compareBelt(n, s.level, m, { a: s.pa, b: s.pb }) }))
  const rows: string[] = [CSV_FIELDS.join(',')]
  for (let b = 0; b < count; b++) {
    const x = xs[b]
    for (const { id, belt } of belts) {
      const iv = belt[x]
      const side = iv.lower > s.ps ? 'left' : iv.upper < s.ps ? 'right' : 'none'
      rows.push([b + 1, id, x / n, '', iv.lower, iv.upper, '', side === 'none' ? 1 : 0, side, iv.upper - iv.lower, '', 'ok'].join(','))
    }
  }
  return meta.join('\n') + '\n' + rows.join('\n') + '\n'
}

/** E06: 격자의 정확 성능 곡선 */
export function curvesCsv(s: LabState, curves: Record<string, Curves>): string {
  const ids = s.cm.filter((m) => curves[m])
  const head = ['p', ...ids.flatMap((m) => [`${m}_coverage`, `${m}_mean_length`, `${m}_miss_left`, `${m}_miss_right`])]
  const grid = curves[ids[0]]?.grid ?? new Float64Array(0)
  const rows = [head.join(',')]
  for (let i = 0; i < grid.length; i++) rows.push([grid[i], ...ids.flatMap((m) => [curves[m].coverage[i], curves[m].meanLength[i], curves[m].missLeft[i], curves[m].missRight[i]])].join(','))
  return `# Interval Lab E06 정확 성능 곡선 (전수 합), n=${s.en}, 수준=${s.level}, 격자 p = 0.001, …, 0.999\n` + rows.join('\n') + '\n'
}

/** E08: 반복마다 신뢰구간(대상 μ)과 예측구간(대상 Y_b) 두 행 */
export function predictionCsv(s: LabState, rows: { b: number; xbar: number; se: number; ci: { lower: number; upper: number }; pi: { lower: number; upper: number }; y: number }[]): string {
  const meta = [
    '# Interval Lab E08 신뢰구간 대 예측구간 — 반복표집 결과',
    `# 설정: ${serializeState(s).toString()}`,
    `# seed=${s.seed} rng=${RNG_ID} normal=${NORMAL_TRANSFORM} engine=${ENGINE_VERSION}`,
    `# 참값 μ=${s.mu}는 교육용 생성 조건. contains_truth의 대상: normal_mean_*는 μ, normal_pred_*는 그 반복의 새 관측값 Y_b`,
  ]
  const out: string[] = [[...CSV_FIELDS, 'target', 'new_obs'].join(',')]
  const m = s.method
  for (const r of rows) {
    const ciHit = r.ci.lower <= s.mu && s.mu <= r.ci.upper
    const ciSide = ciHit ? 'none' : r.ci.lower > s.mu ? 'left' : 'right'
    out.push([r.b + 1, `normal_mean_${m}`, num(r.xbar), num(r.se), num(r.ci.lower), num(r.ci.upper), '', ciHit ? 1 : 0, ciSide, num(r.ci.upper - r.ci.lower), '', 'ok', 'mu', num(r.y)].join(','))
    const piHit = r.pi.lower <= r.y && r.y <= r.pi.upper
    const piSide = piHit ? 'none' : r.pi.lower > r.y ? 'left' : 'right'
    out.push([r.b + 1, `normal_pred_${m}`, num(r.xbar), num(r.se), num(r.pi.lower), num(r.pi.upper), '', piHit ? 1 : 0, piSide, num(r.pi.upper - r.pi.lower), '', 'ok', 'new_obs', num(r.y)].join(','))
  }
  return meta.join('\n') + '\n' + out.join('\n') + '\n'
}
