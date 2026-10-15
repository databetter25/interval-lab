// 방법 카탈로그 (PRD v2 §8.2 방법 메타데이터). 사이트가 구현한 구간 방법마다 대상·구성·뒤집은 검정·가정·보장을 적는다.

export type Construction = 'pivot' | 'test_inversion' | 'cdf_inversion' | 'posterior' | 'fiducial' | 'resampling'
export type Guarantee = 'exact' | 'conservative' | 'asymptotic' | 'none'

export interface MethodMeta {
  id: string
  label: string
  labelEn: string
  estimand: string
  model: string
  construction: Construction
  invertedTest?: string
  assumptions: string[]
  exact: boolean
  guarantee: Guarantee
  boundary?: string
  set?: boolean
  section: string
  scope: '교재' | '확장'
  exp: string
  /** KaTeX 식 */
  formula: string
}

export const CONSTRUCTION_LABEL: Record<Construction, string> = {
  pivot: '피벗량',
  test_inversion: '검정 역산',
  cdf_inversion: 'CDF 역산',
  posterior: '사후분포',
  fiducial: '피듀셜',
  resampling: '재표집',
}

export const GUARANTEE_LABEL: Record<Guarantee, string> = {
  exact: '정확 (모든 θ에서 = 1 − α)',
  conservative: '보수적 (모든 θ에서 ≥ 1 − α)',
  asymptotic: '점근적 (n → ∞에서 1 − α)',
  none: '반복표집 보장 없음',
}

export const METHODS: MethodMeta[] = [
  {
    id: 'z-mean', label: '정규평균 z 구간 (σ 알려짐)', labelEn: 'z interval', estimand: 'μ', model: '정규', construction: 'pivot', invertedTest: '양측 z 검정',
    assumptions: ['독립·동일분포', '정규 모집단', 'σ 알려짐'], exact: true, guarantee: 'exact', section: '8.2.1', scope: '교재', exp: 'e01',
    formula: String.raw`\bar x \pm z_{\alpha/2}\,\sigma/\sqrt n`,
  },
  {
    id: 't-mean', label: '정규평균 t 구간 (σ 미지)', labelEn: 't interval', estimand: 'μ', model: '정규', construction: 'pivot', invertedTest: '양측 t 검정',
    assumptions: ['독립·동일분포', '정규 모집단'], exact: true, guarantee: 'exact', section: '8.2.1', scope: '교재', exp: 'e03',
    formula: String.raw`\bar x \pm t_{\alpha/2,\,n-1}\,s/\sqrt n`,
  },
  {
    id: 'clt-mean', label: '대표본 평균 구간 (중심극한정리)', labelEn: 'large-sample z interval', estimand: 'μ', model: '일반', construction: 'pivot', invertedTest: '대표본 z 검정',
    assumptions: ['독립·동일분포', '유한 분산', 'n이 충분히 큼'], exact: false, guarantee: 'asymptotic', section: '8.2.2', scope: '교재', exp: 'e09',
    formula: String.raw`\bar x \pm z_{\alpha/2}\,s/\sqrt n`,
  },
  {
    id: 'chi2-var', label: '정규분산 χ² 구간', labelEn: 'chi-square interval for σ²', estimand: 'σ²', model: '정규', construction: 'pivot', invertedTest: 'χ² 분산 검정',
    assumptions: ['독립·동일분포', '정규 모집단 (위반에 민감)'], exact: true, guarantee: 'exact', section: '8.3', scope: '교재', exp: 'e03',
    formula: String.raw`\Big[\tfrac{(n-1)s^2}{\chi^2_{1-\alpha/2,\,n-1}},\ \tfrac{(n-1)s^2}{\chi^2_{\alpha/2,\,n-1}}\Big]`,
  },
  {
    id: 'f-ratio', label: '분산비 F 구간', labelEn: 'F interval for σ₁²/σ₂²', estimand: 'σ₁²/σ₂²', model: '정규 두 모집단', construction: 'pivot', invertedTest: 'F 검정',
    assumptions: ['두 독립 정규표본'], exact: true, guarantee: 'exact', section: '8.5', scope: '교재', exp: 'e03',
    formula: String.raw`\Big[\tfrac{s_1^2/s_2^2}{F_{1-\alpha/2}},\ \tfrac{s_1^2/s_2^2}{F_{\alpha/2}}\Big]`,
  },
  {
    id: 'wald', label: 'Wald 구간 (교재 8.6)', labelEn: 'Wald interval', estimand: 'p', model: '이항', construction: 'test_inversion', invertedTest: 'Wald 검정 (SE를 p̂에서)',
    assumptions: ['독립 시행', 'np, n(1 − p)가 충분히 큼'], exact: false, guarantee: 'none', boundary: 'x = 0 또는 n이면 폭 0', section: '8.6.1', scope: '교재', exp: 'e06',
    formula: String.raw`\hat p \pm z_{\alpha/2}\sqrt{\hat p(1-\hat p)/n}`,
  },
  {
    id: 'wilson', label: 'Wilson 구간', labelEn: 'Wilson score interval', estimand: 'p', model: '이항', construction: 'test_inversion', invertedTest: '점수 검정 (SE를 p₀에서)',
    assumptions: ['독립 시행'], exact: false, guarantee: 'asymptotic', section: '8.6.1 확장', scope: '확장', exp: 'e06',
    formula: String.raw`\Big\{p_0 : \tfrac{|\hat p - p_0|}{\sqrt{p_0(1-p_0)/n}} \le z_{\alpha/2}\Big\}`,
  },
  {
    id: 'cp', label: 'Clopper–Pearson 구간', labelEn: 'Clopper–Pearson exact interval', estimand: 'p', model: '이항', construction: 'cdf_inversion', invertedTest: '두 단측 정확 이항검정 (각 α/2)',
    assumptions: ['독립 시행'], exact: true, guarantee: 'conservative', boundary: 'x = 0이면 하한 0, x = n이면 상한 1', section: '8.6.1 확장', scope: '확장', exp: 'e02',
    formula: String.raw`\big[B(\tfrac\alpha2;\,x,\,n-x+1),\ B(1-\tfrac\alpha2;\,x+1,\,n-x)\big]`,
  },
  {
    id: 'jeffreys', label: 'Jeffreys 구간', labelEn: 'Jeffreys interval', estimand: 'p', model: '이항', construction: 'posterior', invertedTest: '없음 (Beta(½, ½) 사전의 동일꼬리 신용구간)',
    assumptions: ['독립 시행', 'Jeffreys 사전'], exact: false, guarantee: 'asymptotic', boundary: '변형: x = 0이면 하한 0, x = n이면 상한 1', section: '8.6.1 확장', scope: '확장', exp: 'e06',
    formula: String.raw`\big[B(\tfrac\alpha2;\,x+\tfrac12,\,n-x+\tfrac12),\ B(1-\tfrac\alpha2;\,x+\tfrac12,\,n-x+\tfrac12)\big]`,
  },
  {
    id: 'ac', label: 'Agresti–Coull 구간', labelEn: 'Agresti–Coull interval', estimand: 'p', model: '이항', construction: 'test_inversion', invertedTest: 'Wilson 중심을 쓴 Wald형 근사',
    assumptions: ['독립 시행'], exact: false, guarantee: 'asymptotic', section: '8.6.1 확장', scope: '확장', exp: 'e06',
    formula: String.raw`\tilde p \pm z_{\alpha/2}\sqrt{\tilde p(1-\tilde p)/\tilde n},\ \tilde n = n + z^2,\ \tilde p = (x + z^2/2)/\tilde n`,
  },
  {
    id: 'lr', label: '가능도비 구간 (이항)', labelEn: 'likelihood ratio interval', estimand: 'p', model: '이항', construction: 'test_inversion', invertedTest: '가능도비 검정 (χ²₁ 근사)',
    assumptions: ['독립 시행'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e06',
    formula: String.raw`\{p_0 : -2\log\Lambda(p_0) \le \chi^2_{1,\,1-\alpha}\}`,
  },
  {
    id: 'normal-credible', label: '정규평균 신용구간 (평탄·정규 사전)', labelEn: 'normal credible interval', estimand: 'μ', model: '정규', construction: 'posterior',
    assumptions: ['정규 모집단', 'σ 알려짐', '사전분포'], exact: false, guarantee: 'none', section: '9.4–9.6', scope: '교재', exp: 'e07',
    formula: String.raw`\mu_n \pm z_{\alpha/2}\,\tau_n,\quad \tfrac1{\tau_n^2} = \tfrac1{\tau_0^2} + \tfrac{n}{\sigma^2}`,
  },
  {
    id: 'hpd', label: 'HPD 신용집합', labelEn: 'HPD credible set', estimand: 'θ', model: '사후분포', construction: 'posterior',
    assumptions: ['사전분포와 모형'], exact: false, guarantee: 'none', set: true, section: '9.4 (정의 9.2)', scope: '교재', exp: 'e12',
    formula: String.raw`\{\theta : \pi(\theta \mid x) \ge h\},\ \ P(\cdot \mid x) = 1-\alpha`,
  },
  {
    id: 'equal-tail', label: '동일꼬리 신용구간', labelEn: 'equal-tailed credible interval', estimand: 'θ', model: '사후분포', construction: 'posterior',
    assumptions: ['사전분포와 모형'], exact: false, guarantee: 'none', section: '9.4 (정의 9.3)', scope: '교재', exp: 'e12',
    formula: String.raw`\big[\pi^{-1}(\tfrac\alpha2 \mid x),\ \pi^{-1}(1-\tfrac\alpha2 \mid x)\big]`,
  },
  {
    id: 'unif-max', label: '균등분포 최댓값 구간', labelEn: 'interval for θ of Uniform(0, θ)', estimand: 'θ', model: 'Uniform(0, θ)', construction: 'cdf_inversion', invertedTest: 'X₍ₙ₎에 근거한 검정',
    assumptions: ['독립·동일분포'], exact: true, guarantee: 'exact', section: '확장 (CB 9.2.3)', scope: '확장', exp: 'e13',
    formula: String.raw`\big[x_{(n)}\,b^{-1/n},\ x_{(n)}\,a^{-1/n}\big],\ b - a = 1 - \alpha`,
  },
  {
    id: 'prediction', label: '정규 예측구간', labelEn: 'prediction interval', estimand: '새 관측값 X_{n+1}', model: '정규', construction: 'pivot',
    assumptions: ['독립·동일분포', '정규 모집단'], exact: true, guarantee: 'exact', section: '확장', scope: '확장', exp: 'e08',
    formula: String.raw`\bar x \pm t_{\alpha/2,\,n-1}\,s\sqrt{1 + 1/n}`,
  },
  {
    id: 'tolerance', label: '정규 허용구간', labelEn: 'tolerance interval', estimand: '모집단의 비율 β 이상', model: '정규', construction: 'pivot',
    assumptions: ['독립·동일분포', '정규 모집단'], exact: true, guarantee: 'exact', section: '확장', scope: '확장', exp: 'e08',
    formula: String.raw`\bar x \pm k\,s,\ \ P\{P(\bar X - kS \le Y \le \bar X + kS) \ge \beta\} = \gamma`,
  },
  {
    id: 'pooled-t', label: '합동 t 구간 (두 평균 차)', labelEn: 'pooled t interval', estimand: 'μ₁ − μ₂', model: '정규 두 모집단', construction: 'pivot', invertedTest: '합동 두 표본 t 검정',
    assumptions: ['두 독립 정규표본', '등분산'], exact: true, guarantee: 'exact', section: '8.4.1', scope: '교재', exp: 'e11',
    formula: String.raw`\bar x_1 - \bar x_2 \pm t_{\alpha/2,\,n_1+n_2-2}\,s_p\sqrt{1/n_1 + 1/n_2}`,
  },
  {
    id: 'large-two', label: '대표본 두 평균 차 구간', labelEn: 'large-sample interval for μ₁ − μ₂', estimand: 'μ₁ − μ₂', model: '일반 두 모집단', construction: 'pivot',
    assumptions: ['두 독립표본', 'n₁, n₂가 충분히 큼'], exact: false, guarantee: 'asymptotic', section: '8.4.2', scope: '교재', exp: 'e11',
    formula: String.raw`\bar x_1 - \bar x_2 \pm z_{\alpha/2}\sqrt{s_1^2/n_1 + s_2^2/n_2}`,
  },
  {
    id: 'welch', label: 'Welch 구간', labelEn: 'Welch interval', estimand: 'μ₁ − μ₂', model: '정규 두 모집단', construction: 'pivot', invertedTest: 'Welch t 검정',
    assumptions: ['두 독립 정규표본', '이분산 허용'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e11',
    formula: String.raw`\bar x_1 - \bar x_2 \pm t_{\alpha/2,\,\hat\nu}\sqrt{s_1^2/n_1 + s_2^2/n_2}`,
  },
  {
    id: 'paired', label: '대응 t 구간', labelEn: 'paired t interval', estimand: 'μ_D', model: '정규 차이', construction: 'pivot', invertedTest: '대응 t 검정',
    assumptions: ['쌍 사이 독립', '차이가 정규'], exact: true, guarantee: 'exact', section: '8.4.3', scope: '교재', exp: 'e11',
    formula: String.raw`\bar d \pm t_{\alpha/2,\,n-1}\,s_d/\sqrt n`,
  },
  {
    id: 'prop-diff-wald', label: '두 비율 차 Wald 구간', labelEn: 'Wald interval for p₁ − p₂', estimand: 'p₁ − p₂', model: '두 이항', construction: 'test_inversion',
    assumptions: ['두 독립 이항표본', '대표본'], exact: false, guarantee: 'none', section: '8.6.2', scope: '교재', exp: 'e11',
    formula: String.raw`\hat p_1 - \hat p_2 \pm z_{\alpha/2}\sqrt{\tfrac{\hat p_1(1-\hat p_1)}{n_1} + \tfrac{\hat p_2(1-\hat p_2)}{n_2}}`,
  },
  {
    id: 'newcombe', label: 'Newcombe 구간 (두 비율 차)', labelEn: 'Newcombe hybrid score interval', estimand: 'p₁ − p₂', model: '두 이항', construction: 'test_inversion', invertedTest: '각 비율의 Wilson 구간을 결합',
    assumptions: ['두 독립 이항표본'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e11',
    formula: String.raw`\hat d - \sqrt{(\hat p_1 - l_1)^2 + (u_2 - \hat p_2)^2},\ \ \hat d + \sqrt{(u_1 - \hat p_1)^2 + (\hat p_2 - l_2)^2}`,
  },
  {
    id: 'boot-percentile', label: '부트스트랩 백분위수 구간', labelEn: 'bootstrap percentile interval', estimand: 'θ (평균·중앙값·분산)', model: '일반', construction: 'resampling',
    assumptions: ['독립·동일분포', '표본이 모집단을 대표'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e14',
    formula: String.raw`[\hat\theta^*_{(\alpha/2)},\ \hat\theta^*_{(1-\alpha/2)}]`,
  },
  {
    id: 'boot-basic', label: '부트스트랩 basic 구간', labelEn: 'basic bootstrap interval', estimand: 'θ', model: '일반', construction: 'resampling',
    assumptions: ['독립·동일분포', 'θ̂* − θ̂ ≈ θ̂ − θ (분포)'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e14',
    formula: String.raw`[2\hat\theta - \hat\theta^*_{(1-\alpha/2)},\ 2\hat\theta - \hat\theta^*_{(\alpha/2)}]`,
  },
  {
    id: 'boot-bca', label: '부트스트랩 BCa 구간', labelEn: 'BCa interval', estimand: 'θ', model: '일반', construction: 'resampling',
    assumptions: ['독립·동일분포', '단조변환 아래 정규 근사'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e14',
    formula: String.raw`[\hat\theta^*_{(\alpha_1)},\ \hat\theta^*_{(\alpha_2)}],\ \alpha_{1,2}\text{는 } z_0,\ a\text{로 보정}`,
  },
  {
    id: 'gpq-lognormal', label: '로그정규 평균 GPQ 구간', labelEn: 'generalized fiducial (GPQ) interval', estimand: 'e^{μ + σ²/2}', model: '로그정규', construction: 'fiducial',
    assumptions: ['독립·동일분포', '로그가 정규'], exact: false, guarantee: 'none', section: '확장', scope: '확장', exp: 'e15',
    formula: String.raw`\big[e^{G_{(\alpha/2)}},\ e^{G_{(1-\alpha/2)}}\big],\ G = G_\mu + G_{\sigma^2}/2`,
  },
  {
    id: 'cox-lognormal', label: '로그정규 평균 Cox 근사', labelEn: 'Cox method', estimand: 'e^{μ + σ²/2}', model: '로그정규', construction: 'pivot',
    assumptions: ['독립·동일분포', '로그가 정규', 'n이 충분히 큼'], exact: false, guarantee: 'asymptotic', section: '확장', scope: '확장', exp: 'e15',
    formula: String.raw`\exp\!\Big(\bar y + \tfrac{s^2}{2} \pm z_{\alpha/2}\sqrt{\tfrac{s^2}{n} + \tfrac{s^4}{2(n-1)}}\Big)`,
  },
]
