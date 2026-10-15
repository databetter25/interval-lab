// 출처 레코드 (PRD v2 §5.4, 부록 B). review_status: 초안 | 대조완료 | 교수검토완료

export type SourceKind = '교재' | '워크북' | 'CB2' | '논문' | '웹'
export type ReviewStatus = '초안' | '대조완료' | '교수검토완료'

export interface SourceRecord {
  id: string
  kind: SourceKind
  title: string
  section?: string
  url?: string
  accessed?: string
  status: ReviewStatus
  usedIn: string[]
  note?: string
}

export const SOURCES: SourceRecord[] = [
  {
    id: 'TB-8', kind: '교재', title: '『통계학의 개념 및 제문제』 제8장 구간추정', section: '8.1–8.8 (인쇄 299–332쪽)', status: '대조완료',
    usedIn: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E09', 'E11'], note: '본문·그림·문항은 싣지 않고 수치 설정만 재현',
  },
  {
    id: 'TB-9', kind: '교재', title: '『통계학의 개념 및 제문제』 제9장 베이즈 추론', section: '9.4 신용구간 (인쇄 344–347쪽), 예 9.7·9.8', status: '대조완료',
    usedIn: ['E07', 'E12'], note: '예 9.7의 사후 Beta(4, 8)과 예 9.8의 HPD를 기준값으로 등록',
  },
  { id: 'WB', kind: '워크북', title: '워크북', status: '초안', usedIn: [], note: '작업 폴더에 없어 확인하지 못함. 문항 근거로 쓰지 않음' },
  {
    id: 'CB2', kind: 'CB2', title: 'Casella, G. & Berger, R. L. (2002). Statistical Inference, 2nd ed., 제9장', section: '9.1–9.3 (절 번호로만 연결)',
    url: 'https://www.routledge.com/Statistical-Inference/Berger-Casella/p/book/9781032593036', accessed: '2026-10-14', status: '초안', usedIn: ['E02', 'E03', 'E04', 'E10', 'E13'],
  },
  { id: 'Bayes1763', kind: '논문', title: 'Bayes, T. (1763). An essay towards solving a problem in the doctrine of chances. Phil. Trans. R. Soc., 53, 370–418', status: '초안', usedIn: ['역사'], note: '사후에 R. Price가 제출' },
  { id: 'Fisher1930', kind: '논문', title: 'Fisher, R. A. (1930). Inverse probability. Proc. Cambridge Phil. Soc., 26(4), 528–535', status: '초안', usedIn: ['E07', '역사'] },
  { id: 'Fisher1935', kind: '논문', title: 'Fisher, R. A. (1935). The fiducial argument in statistical inference. Annals of Eugenics, 6(4), 391–398', status: '초안', usedIn: ['역사'] },
  { id: 'Efron1979', kind: '논문', title: 'Efron, B. (1979). Bootstrap methods: another look at the jackknife. Annals of Statistics, 7(1), 1–26', status: '초안', usedIn: ['E14', '역사'] },
  { id: 'Hannig2009', kind: '논문', title: 'Hannig, J. (2009). On generalized fiducial inference. Statistica Sinica, 19(2), 491–544', status: '초안', usedIn: ['E15', '역사'] },
  { id: 'Neyman1937', kind: '논문', title: 'Neyman, J. (1937). Outline of a theory of statistical estimation based on the classical theory of probability. Phil. Trans. R. Soc. A, 236, 333–380', url: 'https://doi.org/10.1098/rsta.1937.0005', accessed: '2026-10-14', status: '초안', usedIn: ['E02', '역사'] },
  { id: 'CP1934', kind: '논문', title: 'Clopper, C. J. & Pearson, E. S. (1934). The use of confidence or fiducial limits illustrated in the case of the binomial. Biometrika, 26(4), 404–413', status: '초안', usedIn: ['E02', 'E06'] },
  { id: 'Wilson1927', kind: '논문', title: 'Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. JASA, 22(158), 209–212', status: '초안', usedIn: ['E06'] },
  { id: 'AC1998', kind: '논문', title: 'Agresti, A. & Coull, B. A. (1998). Approximate is better than “exact” for interval estimation of binomial proportions. The American Statistician, 52(2), 119–126', status: '초안', usedIn: ['E06'] },
  { id: 'BCD2001', kind: '논문', title: 'Brown, L. D., Cai, T. T. & DasGupta, A. (2001). Interval estimation for a binomial proportion. Statistical Science, 16(2), 101–133', status: '초안', usedIn: ['E06'] },
  { id: 'Pratt1961', kind: '논문', title: 'Pratt, J. W. (1961). Length of confidence intervals. JASA, 56(295), 549–567', status: '초안', usedIn: ['E10'] },
  { id: 'Newcombe1998', kind: '논문', title: 'Newcombe, R. G. (1998). Interval estimation for the difference between independent proportions: comparison of eleven methods. Statistics in Medicine, 17(8), 873–890', status: '초안', usedIn: ['E11'] },
  { id: 'Howe1969', kind: '논문', title: 'Howe, W. G. (1969). Two-sided tolerance limits for normal populations — some improvements. JASA, 64(326), 610–620', status: '초안', usedIn: ['E08'] },
  { id: 'Efron1987', kind: '논문', title: 'Efron, B. (1987). Better bootstrap confidence intervals. JASA, 82(397), 171–185', status: '초안', usedIn: ['E14'] },
  { id: 'Weerahandi1993', kind: '논문', title: 'Weerahandi, S. (1993). Generalized confidence intervals. JASA, 88(423), 899–905', status: '초안', usedIn: ['E15'] },
  { id: 'KM2003', kind: '논문', title: 'Krishnamoorthy, K. & Mathew, T. (2003). Inferences on the means of lognormal distributions using generalized p-values and generalized confidence intervals. JSPI, 115(1), 103–121', status: '초안', usedIn: ['E15'] },
  { id: 'KL2010', kind: '논문', title: 'Krishnamoorthy, K. & Lee, M. (2010). Inference for functions of parameters in discrete distributions based on fiducial approach: binomial and Poisson cases. JSPI, 140, 1182–1192', url: 'https://userweb.ucs.louisiana.edu/~kxk4695/JSPI2010.pdf', accessed: '2026-10-14', status: '초안', usedIn: ['E06', 'E07'] },
  { id: 'Reid', kind: '논문', title: 'Reid, N. Distributions for parameters. In Handbook of Bayesian, Fiducial, and Frequentist Inference', url: 'https://utstat.toronto.edu/reid/research/9780429341731_Chapter_3.pdf', accessed: '2026-10-14', status: '초안', usedIn: ['E07', '역사'] },
  { id: 'WP', kind: '웹', title: 'Wikipedia: Interval estimation, Confidence interval, Credible interval, Fiducial inference', url: 'https://en.wikipedia.org/wiki/Confidence_interval', accessed: '2026-10-14', status: '초안', usedIn: ['용어'], note: '용어 탐색용 보조 자료. 정의는 교재·전문문헌과 교차 확인' },
]
