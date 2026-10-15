// 용어·해석 (PRD v2 §1.2 오개념 카탈로그, §10.1 필수·금지 해석, §10.4 용어집)

export interface Misconception {
  id: string
  wrong: string
  right: string
  exps: string[]
}

export const MISCONCEPTIONS: Misconception[] = [
  { id: 'M1', wrong: '관측한 95% 신뢰구간에 모수가 있을 확률이 95%다', right: '95%는 절차의 반복표집 포함률이다. 관측된 구간은 포함하거나 포함하지 않는다', exps: ['e01', 'e07'] },
  { id: 'M2', wrong: '100번 반복하면 반드시 95번 포함한다', right: '포함 개수는 Binomial(B, 1−α)를 따르며 흔들린다', exps: ['e01'] },
  { id: 'M3', wrong: '신뢰구간에 관측값(또는 모집단)의 95%가 들어 있다', right: '모평균 구간, 예측구간, 허용구간은 대상이 다르다', exps: ['e08'] },
  { id: 'M4', wrong: '구간추정과 검정은 별개의 절차다', right: '구간은 기각되지 않는 θ₀의 집합이다', exps: ['e02', 'e04'] },
  { id: 'M5', wrong: '짧은 구간이 언제나 좋은 구간이다', right: '포함률을 먼저 확인하고 그다음 길이를 비교한다', exps: ['e06', 'e10'] },
  { id: 'M6', wrong: '명목수준과 실제 포함률은 항상 같다', right: '근사법, 이산분포, 가정 위반에서는 달라진다', exps: ['e06', 'e09'] },
  { id: 'M7', wrong: '표본크기를 2배로 늘리면 구간 폭이 절반이 된다', right: '폭은 1/√n에 비례하므로 절반이 되려면 4배가 필요하다', exps: ['e05'] },
  { id: 'M8', wrong: '95% 신용구간도 95% 포함률을 보장한다', right: '사후질량과 고정 θ에서의 포함률은 다른 양이다', exps: ['e06', 'e07'] },
  { id: 'M9', wrong: '같은 신뢰수준이면 구간은 하나로 정해진다', right: '꼬리 배분이나 구성법이 달라지면 다른 구간이 나온다', exps: ['e03', 'e13'] },
  { id: 'M10', wrong: '기각하지 못하면 H₀가 참이라는 뜻이다', right: '기각하지 못한 값들의 집합이 바로 구간이다. 증명된 것은 없다', exps: ['e04'] },
  { id: 'M11', wrong: '피셔·네이만·베이즈의 차이는 공식의 차이일 뿐이다', right: '같은 끝점이어도 확률이 붙는 대상이 다르다', exps: ['e07'] },
]

export const misconceptionById = (id: string) => MISCONCEPTIONS.find((m) => m.id === id)

/** 필수 해석(사이트 문구의 기준)과 금지·교정 대상 */
export const INTERPRETATIONS: { ok: string; no: string; mis?: string }[] = [
  { ok: '이 방법을 반복 적용하면 구간의 95%가 참값을 포함한다', no: '이 구간 안에 모수가 있을 확률이 95%다', mis: 'M1' },
  { ok: '이 구간은 μ에 대한 95% 신뢰구간이며, 관측된 구간은 μ를 포함하거나 포함하지 않는다', no: 'μ가 95% 확률로 이 구간 안에서 움직인다', mis: 'M1' },
  { ok: '사전분포·모형·자료 아래에서 사후질량이 95%다', no: '신용구간은 반복표집 포함률 95%를 보장한다', mis: 'M8' },
  { ok: '모평균에 대한 구간이다', no: '관측값의 95%가 이 구간 안에 있다', mis: 'M3' },
  { ok: '이 단순 모형과 구성에서는 세 관점의 끝점이 같다', no: '네이만·피셔·베이즈 구간은 항상 같다', mis: 'M11' },
  { ok: '피듀셜 구성과 해석에는 조건과 논쟁이 있다', no: '사전분포 없는 베이즈 사후분포가 언제나 존재한다', mis: 'M11' },
  { ok: '정확 구간은 모든 모수값에서 명목수준 이상의 포함률을 보장한다', no: '정확 구간의 포함률은 언제나 정확히 95%다', mis: 'M6' },
  { ok: 'H₀: θ = θ₀를 기각하지 못한 θ₀들의 집합이 신뢰구간이다', no: '기각하지 못했으므로 θ₀가 참이다', mis: 'M10' },
  { ok: 'p-값은 H₀ 아래에서 관측한 것 이상으로 극단적인 결과가 나올 확률이다', no: 'p-값은 H₀가 참일 확률이다', mis: 'M10' },
]

export const GLOSSARY: { ko: string; en: string; note?: string; exp?: string }[] = [
  { ko: '구간추정 / 신뢰구간', en: 'interval estimation / confidence interval', exp: 'e01' },
  { ko: '신뢰수준 / 신뢰계수', en: 'confidence level / confidence coefficient', note: '교재는 반복의 극한 비율로 정의한다. 신뢰계수는 모든 θ에서 포함률의 하한(inf)', exp: 'e01' },
  { ko: '포함률(포함확률)', en: 'coverage probability', note: '고정된 θ에서의 P_θ{θ ∈ C(X)}', exp: 'e06' },
  { ko: '명목수준', en: 'nominal level', note: '방법이 표방하는 1 − α', exp: 'e06' },
  { ko: '채택역 / 기각역', en: 'acceptance region / rejection region', note: '교재 8.7', exp: 'e02' },
  { ko: '신뢰띠', en: 'confidence belt', note: '네이만 구성: 모든 θ₀의 채택역을 쌓은 것', exp: 'e02' },
  { ko: 'p-값 함수 / 신뢰 곡선', en: 'p-value function / confidence curve', exp: 'e04' },
  { ko: '오포함확률', en: 'probability of false coverage', note: 'θ′ ≠ θ가 포함될 확률 = H₀: θ = θ′ 검정의 1 − 검정력', exp: 'e10' },
  { ko: '피벗량', en: 'pivotal quantity', note: '분포가 모수에 의존하지 않는 자료·모수의 함수', exp: 'e03' },
  { ko: '장애모수', en: 'nuisance parameter', note: '관심 대상은 아니지만 분포에 끼어 있는 모수 (예: μ의 구간에서 σ)', exp: 'e15' },
  { ko: 'CDF 역산', en: 'pivoting the CDF', note: 'F_T(t; θ)가 θ에 대해 단조일 때 F = α/2, 1 − α/2를 풀어 끝점을 얻는다', exp: 'e13' },
  { ko: '점수 검정 / 왈드 검정 / 가능도비 검정', en: 'score test / Wald test / likelihood ratio test', note: '뒤집으면 각각 Wilson / Wald / 가능도비 구간', exp: 'e06' },
  { ko: '정확 / 보수적 / 근사', en: 'exact / conservative / approximate', note: '정확: 모든 θ에서 포함률 ≥ 명목수준(이산분포에서는 보통 초과 = 보수적)', exp: 'e06' },
  { ko: '신용구간 / 신용집합', en: 'credible interval / credible set', note: '교재 정의 9.1', exp: 'e07' },
  { ko: '최고사후밀도 집합', en: 'highest posterior density (HPD) set', note: '교재 정의 9.2. 여러 조각일 수 있다', exp: 'e12' },
  { ko: '동일꼬리 신용구간', en: 'equal-tailed credible interval', note: '교재 정의 9.3', exp: 'e12' },
  { ko: '예측구간 / 허용구간', en: 'prediction interval / tolerance interval', note: '새 관측값 하나 / 모집단의 비율 β 이상을 신뢰수준 γ로 덮음', exp: 'e08' },
  { ko: '피듀셜', en: 'fiducial', note: '피셔의 고전적 논법과 현대의 일반화 피듀셜을 구분한다', exp: 'e07' },
  { ko: '일반화 피벗량', en: 'generalized pivotal quantity (GPQ)', note: '관측값을 고정하고 무작위성만 다시 뽑아 만든 피벗. 포함률은 시뮬레이션으로 확인', exp: 'e15' },
  { ko: '부트스트랩 / 재표집분포', en: 'bootstrap / bootstrap distribution', note: '관측 표본에서 복원추출로 다시 뽑은 통계량의 분포', exp: 'e14' },
  { ko: '몬테카를로 표준오차', en: 'Monte Carlo standard error', note: '시뮬레이션 포함률의 흔들림 √(p(1 − p)/B)', exp: 'e01' },
]
