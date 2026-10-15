# 구간 실험실 (Interval Lab)

『통계학의 개념 및 제문제』 제8장 구간추정을 "신뢰구간은 뒤집은 검정이다"라는 관점에서 시뮬레이션으로 배우는 정적 웹사이트.
사이트: https://databetter25.github.io/interval-lab/

기획 문서(PRD v2)는 저장소 밖에서 관리한다. 짝 사이트: [검정 실험실](https://databetter25.github.io/hypothesis-lab/) (제7장).

교재 예제는 수치 설정만 재현하며 교재 본문·그림은 싣지 않는다. 교재·워크북 PDF는 저장소에 포함하지 않는다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 엔진 기준값·속성·몬테카를로·상태 테스트 (vitest)
npm run e2e      # 배포 빌드로 E2E·접근성(axe)·모바일 테스트 (Playwright)
npm run build    # dist/ 정적 산출물 (상대 경로, 서비스 워커 포함)
```

기준값을 바꾸려면 `python tools/golden.py`(SciPy)를 실행한 뒤 `npm test`로 대조한다.

## 구현 범위 (P0 E01–E08, P1 E03의 χ²·F와 E09–E13, P2 E14·E15·E06 가능도비·E11 Newcombe·E10 손실함수)

| 실험 | 내용 | 경로 |
|---|---|---|
| E01 반복표집 실험실 | z·t, 양측·단측, 수렴 깔때기, 100개 묶음 포함 개수 분포, 참값 숨기기, 교재 [프로그램 8.1] 재현 프리셋, R 코드 | `#/lab/e01` |
| E02 채택역에서 신뢰띠로 | 4단계 공개(검정 하나 → 띠 쌓기 → 가로로 자르기 → 반복표집), 7장 미니뷰. **정규**(연속 띠)와 **이항**(계단 띠: 정확검정→CP, score→Wilson, Wald→교재 8.6.1, 띠 겹쳐 보기, 정확 포함률 c(p*)와 포함률 함수) | `#/lab/e02`, `#/lab/e02?model=binom` |
| E03 피벗량으로 구간 만들기 | z·t(P0)와 χ² 모분산·F 분산비(P1). 4단계 공개(피벗 분포 → 확률 문장 → 부등식 변형, 부등호가 뒤집히는 단계 강조 → 자료 대입), 꼬리 배분 α_L/α와 한쪽 구간, 배분–길이 곡선과 최단 배분, 교재 z_(α/2) ↔ Q_(1−α/2) 대응표 | `#/lab/e03` |
| E04 검정 역산과 p-값 함수 | **정규**: μ₀ 슬라이더, 기각 ⟺ μ₀ ∉ C, p-값 함수와 신뢰 곡선, 단측 대응. **이항**: 정확검정·score·Wald의 p-값 함수 비교, 정확검정의 작은 쪽 꼬리 표시, CP 끝점에서 p = α | `#/lab/e04`, `#/lab/e04?model=binom` |
| E05 설계 변수 | 계산 비교(자료 고정, 표본을 뽑지 않음): n–E 곡선(로그–로그), 수준–길이와 꼬리 면적, 표본크기 n = ⌈(qσ/E)²⌉(조건 배지)과 σ 미지 t의 기대 길이·표본크기. 반복실험 비교: 두 설계(n, 수준)의 포함률과 길이 | `#/lab/e05` |
| E06 이항구간 비교 | Wald·Wilson·CP·Jeffreys(+ Agresti–Coull, Beta 사전, 경계 변형 2종). 같은 x의 구간 표, 포함률·평균 길이·좌우 비포함의 정확 곡선(격자 999점, n > 150은 Worker), p*에서 시뮬레이션 대조, p*에서 포함되는 x 막대, 근사 피듀셜·경계 정책 설명, 곡선 CSV | `#/lab/e06` |
| E07 같은 구간, 세 관점 | 네이만·베이즈·피듀셜 세 패널(같은 끝점, §10.1 문장 그대로), 평탄/정규 사전, ① 반복표집(μ 고정)과 ② 사후·μ* 표집(자료 고정)을 따로 실행, ③ 신용구간의 고정 μ 포함률(정확식 + 같은 표본의 MC) | `#/lab/e07` |
| E08 추정 대상이 다른 구간 | 신뢰·신용·예측·허용구간의 대상(개념 카드), 같은 반복표집에서 신뢰구간 대 예측구간(z·t)이 μ와 새 관측값을 포함한 비율, 예측구간이 덮은 모집단 비율의 분포, 허용구간 계산(P2: 정확 양측·Howe·단측 비중심 t, β 이상을 덮은 비율 ≈ γ 확인), 선택한 반복의 원자료 | `#/lab/e08` |
| E09 가정 위반과 대표본 근사 (P1) | 평균·분산을 맞춘 정규·지수·로그정규·t₃ 모집단, 왜도·첨도 표시. 평균(t·대표본 z·z)과 분산(χ²) 구간의 표본크기별 포함률(Worker, n마다 2만 회), 현재 n의 반복표집과 좌우 비포함 쏠림 | `#/lab/e09` |
| E10 정확성: 검정력과 길이 (P1) | 오포함확률 P_θ{θ′∈C}와 따로 계산한 1 − 검정력의 일치, Pratt 항등식(곡선 아래 넓이 = 기대 길이), 꼬리 배분·한쪽 구간, σ 미지 t 구간(MC) 비교, 손실함수 관점(P2: 길이 비용 b → 최적 반폭 c*와 그 신뢰수준) | `#/lab/e10` |
| E11 두 모집단 (P1) | 독립(pooled·Welch·대표본 z, 이분산·불균형에서 pooled 붕괴), 대응(ρ에 따른 SE, 설계를 무시한 분석과 비교), 두 비율의 차(Wald 정확 포함률). 분산비 F는 E03으로 연결 | `#/lab/e11` |
| E12 베이즈 심화 (P1) | 동일꼬리 대 HPD(범용: 밀도 ≥ h, 끊어진 성분까지), 교재 예 9.7·9.8 프리셋, 치우친 Gamma·U자형 Beta·다봉 혼합, logit·log 재매개화, 사전 민감도 표 | `#/lab/e12` |
| E13 CDF 역산과 비유일성 (P1) | Uniform(0, θ) 최댓값: 피벗 밀도, b에 따른 길이(최단 b = 1), CDF 역산 그림, 중앙·한쪽·임의 b의 포함률 시뮬레이션 | `#/lab/e13` |
| E14 부트스트랩 구간 (P2) | 재표집분포 대 표본분포(중심 θ̂ 대 θ), 백분위수·basic·BCa(z₀·잭나이프 가속), 포함률 실험(Worker, 표본 500 × 재표집 1,000) | `#/lab/e14` |
| E15 일반화 피듀셜 (P2) | 로그정규 평균 e^(μ+σ²/2)의 일반화 피벗량(GPQ) 구간, Cox 근사·원 척도 t·exp(로그 t)(중앙값용)와 비교, GPQ 분포 대 추정량의 표본분포, 포함률 실험(Worker, 표본 1,000 × GPQ 2,000). numpy 독립 구현·MC로 검증 | `#/lab/e15` |

강의자 도구(`#/teach`): 75분 강의 경로와 바로 가기, 숨김 링크 생성기, 인쇄용 활동지(답·해설 선택).

공통: URL 공유(원자료 없음), 강의용 숨김 링크(참값을 URL에 두지 않고 seed에서 파생, 보안 기능 아님), 설정 JSON 내보내기·불러오기, 결과 CSV, 그림 SVG·PNG, 예상하기와 학습기록(브라우저 저장·JSON 내보내기), 강의 모드(큰 글자·단축키).

## 구조

| 경로 | 내용 |
|---|---|
| `src/engine/` | 순수 계산 엔진. `meanInterval.ts`(z·t 구간, 검정, 채택역), `repeat.ts`(반복표집, 포함 통계), `binomial.ts`(이항 세 검정과 구간, 채택역, 정확 포함률, 이항 표본) |
| `src/engine/core/` | Φ·Φ⁻¹, t분포, 불완전베타, xoshiro128** 난수 — 검정 실험실(hypothesis-lab)에서 가져옴 |
| `src/lib/useReplicates.ts` | 반복 요약값 캐시. 작은 요청은 바로, 큰 요청은 Web Worker에서 계산. E01·E02가 공유 |
| `src/state/labState.ts` | 실험 설정 ↔ URL 쿼리 (URL이 단일 진실원, 잘못된 값은 기본값 복원) |
| `src/content/` | 학습 자료 콘텐츠: 오개념·해석·용어집(guide), 방법 메타데이터(methods), 진단 문항(diagnostic), 출처 레코드(sources) |
| `src/pages/LearnPage.tsx` | 학습 자료 `#/learn/{guide,methods,diagnose,history,sources}` |
| `src/experiments/` | E01–E15 화면 |
| `src/components/chart/` | 구간 더미, 수렴 깔때기, 묶음 히스토그램, 신뢰띠, 표본분포, p-값 함수 |
| `tools/golden.py` | SciPy 기준값 → `tests/golden/golden.json` |

### 재현성

반복 b의 표본은 `(seed, 정규 스트림, b)`만으로 정해진다(`replicateSeed`). 그래서 실행 순서·묶음 크기·Worker와 무관하게 같고, E01과 E02 4단계가 같은 표본을 보며, 선택한 반복의 원자료를 언제든 다시 만들 수 있다. 설정 JSON에는 `rng_algorithm`, `normal_transform`, `engine_version`이 함께 저장된다.

### 검증

- `tests/engine/golden.test.ts`: PRD §9 G01–G04, G13–G15, G18 등
- `tests/engine/properties.test.ts`: 쌍대성(기각 안 함 ⟺ μ₀ ∈ C, x̄ ∈ A(μ₀) ⟺ μ₀ ∈ C(x̄)) 각 1만 회, 수준 단조성, 재현성
- `tests/engine/binomial.test.ts`: G06·G08·G09·G11 끝점·정확 포함률(SciPy 대조), x ∈ A(p₀) ⟺ p₀ ∈ C(x) 1만 회, MC 대 정확 포함률
- `tests/engine/binomCompare.test.ts`: AC-E06-1·2·3 (8개 방법 끝점, 포함률·길이·좌우 비포함, 0.99¹⁰), 격자 요약, n = 1000 성능
- `tests/engine/threeViews.test.ts`: AC-E07-1·2 (세 끝점 일치, 사후 N(98, 20)), 신용구간 포함률 정확식 대 SciPy·MC
- `tests/engine/targets.test.ts`: AC-E08-1·2 (예측구간 G17, 새 관측값 포함률, 신뢰구간의 새 관측값 포함 2Φ(q/√(n+1)) − 1, 모집단 β 이상을 덮을 확률)
- `tests/engine/design.test.ts`: AC-E05-1·2 (E 9.7998199/4.8999100, n = 97), c₄·t 기대 길이 SciPy 대조, t 표본크기, 기대 길이 MC 검증
- `tests/engine/pivot.test.ts`: AC-E03-1·2·3 (t·χ²·F 분위수, 네 피벗 × 다섯 꼬리 배분의 구간, 최단 배분, χ² 포함률 MC)
- `tests/engine/robust.test.ts`: 평균·분산 맞춤, 정규 스트림 공유, PRD E09 참고값(numpy MC 40만 회) 9가지 재현
- `tests/engine/accuracy.test.ts`: AC-E10-1·2, 오포함확률 + 검정력 = 1, t 구간 MC 대 SciPy 비중심 t
- `tests/engine/twoSample.test.ts`: pooled·Welch·대표본 z·대응·두 비율 SciPy 대조, 대응 상관, pooled 붕괴 시뮬레이션
- `tests/engine/bayesSets.test.ts`: 교재 예 9.7·9.8, HPD 질량 1e−6·경계 밀도 1e−8, U자형·다봉의 끊어진 HPD, 재매개화 (SciPy 근 찾기 대조)
- `tests/engine/cdfInversion.test.ts`: E13 수용 기준, bⁿ − aⁿ = 1 − α, 최단 b = 1, CDF 역산 = 피벗, 포함률 MC
- `tests/engine/bootstrap.test.ts`: 같은 표본·재표집 통계량에서 Python 독립 구현과 1e−9 일치, 포함률 numpy MC 대조
- `tests/engine/tolerance.test.ts`: 허용계수(정확 양측·Howe·단측) SciPy 대조, 표준 표 값 2.355, β 이상을 덮은 비율 MC ≈ γ
- `tests/engine/montecarlo.test.ts`: B = 100,000 포함률이 명목수준 ± 4 MC SE 안
- `e2e/`: 수용 기준 AC-E01-1·4·6, AC-E02-1·4, AC-E04-1·2, AC-C1·C2·C3, 강의 모드 단축키, 접근성

## 배포

`main`에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 단위 테스트 → E2E·접근성 → 빌드를 거쳐 통과할 때만 GitHub Pages에 배포한다. 빌드는 상대 경로라 하위 경로(`/interval-lab/`)에서도 동작하고, 서비스 워커가 산출물을 미리 캐시해 한 번 연 뒤에는 오프라인에서도 쓸 수 있다.

## 파일럿 분석 (PRD §2.3, §15.1 S4)

1. 학습자는 홈 화면 ‘내 학습기록’의 **제출 파일 내보내기**에 참가 번호(예: `P07`)만 넣어 `interval-lab-pilot-P07.json`을 만들고, 동의한 경우에만 제출한다. 파일에는 사전·사후 진단의 채점 결과, 예상하기 기록, 연 실험 목록이 들어 있다.
2. 모은 파일을 한 폴더(예: `pilot-data/`, 저장소에 올라가지 않음)에 두고 실행한다.

```bash
python tools/pilot_analysis.py pilot-data/ --out pilot-report/
```

결과: `report.md`(§2.3 지표와 초기 목표 대비 판정, 95% 구간, 문항별·오개념별 표, 한계), `learners.csv`, `items.csv`, `misconceptions.csv`. 학습자의 자유 응답은 `--with-reasons`를 줄 때만 `reasons.csv`로 따로 나온다. 표준 라이브러리만 쓴다.

보고서 모양을 미리 보려면 합성 자료를 만든다: `python tools/pilot_sample.py pilot-data-demo/ --n 24`. 테스트: `python tools/test_pilot_analysis.py`(CI에서도 실행).

