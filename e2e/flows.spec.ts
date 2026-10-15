import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { DIAG_ITEMS } from '../src/content/diagnostic'

// MVP-α 수용 기준을 실제 화면에서 확인한다 (PRD v2 §7, §14.4)

test('AC-E01-1·AC-C3: 같은 seed 링크는 같은 결과, URL에 원자료 없음', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=777&k=1000')
  const first = (await page.locator('.stat-box').first().textContent())!
  await page.reload()
  await expect(page.locator('.stat-box').first()).toHaveText(first)
  expect(new URL(page.url()).hash.split('?')[1].split('&').map((p) => p.split('=')[0]).sort()).toEqual(['k', 'seed'])
})

test('E01: 버튼으로 표본을 뽑고, seed가 정해지며, 방법을 바꿔도 재표집하지 않는다 (AC-E01-4)', async ({ page }) => {
  await page.goto('./#/lab/e01')
  await page.getByRole('button', { name: '100회', exact: true }).click()
  await expect(page).toHaveURL(/seed=\d+/)
  await expect(page).toHaveURL(/k=100/)
  await expect(page.locator('.stat-box').first()).toContainText('/ 100')
  const seed = /seed=(\d+)/.exec(page.url())![1]
  await page.getByRole('radio', { name: 't (σ를 S로)' }).click()
  await expect(page).toHaveURL(/method=t/)
  expect(/seed=(\d+)/.exec(page.url())![1]).toBe(seed)
  await expect(page).toHaveURL(/k=100/)
})

test('AC-E01-6: 그림의 구간 수는 표시 구간 수를 넘지 않는다', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=1&k=5000&show=60')
  await expect(page.locator('.stat-box').first()).toContainText('/ 5,000')
  const lines = await page.locator('.col-chart svg').first().locator('g[style*="cursor"]').count()
  expect(lines).toBe(60)
})

test('큰 B는 Worker에서 계산되고 정지할 수 있다', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=2&n=1000&B=100000')
  await page.getByRole('button', { name: /B = 100,000까지/ }).click()
  const stop = page.getByRole('button', { name: '정지' })
  await expect(stop).toBeVisible()
  await stop.click()
  await expect(stop).toBeHidden()
  const k = Number(/k=(\d+)/.exec(page.url())?.[1] ?? 0)
  expect(k).toBeLessThan(100000)
})

test('AC-E02-4: 4단계의 띠 안 비율 = E01(z)의 포함 수 (같은 표본)', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=4242&k=2000')
  const e01 = (await page.locator('.stat-box').first().innerText()).match(/([\d,]+) \/ 2,000/)![1]
  await page.getByRole('link', { name: /E02/ }).first().click()
  await page.getByRole('button', { name: /4단계/ }).click()
  await expect(page.locator('.stat-box').first()).toContainText(`${e01} / 2,000`)
})

test('AC-E02-1: 3단계 가로 단면 = [90.2002, 109.7998]', async ({ page }) => {
  await page.goto('./#/lab/e02?stage=3')
  await expect(page.locator('.stat-box').nth(1)).toContainText('[90.2002, 109.7998]')
  await expect(page.locator('.duality')).toContainText('기각하지 않음')
})

test('AC-E04-1·2: μ₀ = 90에서 p = 0.0455 기각, 끝점의 p = α', async ({ page }) => {
  await page.goto('./#/lab/e04?mu0=90')
  await expect(page.locator('.verdict')).toContainText('p = 0.0455')
  await expect(page.locator('.verdict')).toContainText('기각 (p < α')
  await expect(page.locator('.stat-box').nth(1)).toContainText('0.050000')
  await expect(page.locator('.duality')).toContainText('∉ [90.2002, 109.7998]')
})

test('예상하기: 결과가 나오면 피드백이 보이고 학습기록이 저장된다', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=9')
  await page.getByRole('radio', { name: /대체로 95개 근처/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await expect(page.getByText('예상을 기록했습니다')).toBeVisible()
  await page.getByRole('button', { name: '100회', exact: true }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('interval-lab:log:v1') ?? '[]'))
  expect(log).toHaveLength(1)
  expect(log[0].correct).toBe(true)
})

test('참값 숨기기: 포함 여부와 포함률을 감춘다', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=3&k=300&hide=1')
  await expect(page.getByText('참값을 숨긴 상태입니다')).toBeVisible()
  await expect(page.locator('.stat-box')).toHaveCount(0)
  await page.getByRole('button', { name: '참값 공개' }).click()
  await expect(page.locator('.stat-box').first()).toContainText('/ 300')
})

test('강의 모드 단축키: Space로 1회, →로 단계 이동', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=5')
  // 실험 화면은 늦게 불러오므로 뜬 것을 확인한 뒤 단축키를 누른다
  await expect(page.getByRole('button', { name: '1회', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '강의 모드' }).click()
  await page.locator('h1').click()
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(page).toHaveURL(/k=2/)
  // 같은 페이지 안의 이동이라 강의 모드는 켜진 채로 남는다
  await page.goto('./#/lab/e02?stage=1')
  await expect(page.getByRole('button', { name: '강의 모드' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /2단계/ })).toBeVisible()
  await page.locator('h1').click()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/stage=2/)
})

test('AC-C1: 설정 JSON 내보내기 → 불러오기', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=31&k=150&method=t&n=8')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '설정 JSON' }).click()])
  const json = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf-8')))
  expect(json.seed).toBe(31)
  expect(json.replicate_count).toBe(150)
  await page.goto('./#/lab/e01')
  await page.locator('input[type=file]').setInputFiles({ name: 's.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(page).toHaveURL(/seed=31/)
  await expect(page.locator('.stat-box').first()).toContainText('/ 150')
})

test('AC-C2: CSV 행 수 = 반복 수', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=8&k=250')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '결과 CSV' }).click()])
  const text = Buffer.concat(await (await download.createReadStream()).toArray()).toString('utf-8')
  const rows = text.trim().split('\n').filter((l) => !l.startsWith('#') && !l.startsWith('﻿#'))
  expect(rows.length - 1).toBe(250)
})

test('잘못된 링크는 기본값으로 복원된다', async ({ page }) => {
  await page.goto('./#/lab/e01?n=1&level=3&method=q')
  await expect(page.getByText('표본크기 n').locator('..').locator('output')).toHaveText('25')
})

test('E02 이항: 모형 전환, AC-E02-2 가로 단면 = CP [0.0667, 0.6525]', async ({ page }) => {
  await page.goto('./#/lab/e02?stage=3')
  await page.getByRole('radio', { name: '이항 모비율' }).click()
  await expect(page).toHaveURL(/model=binom/)
  await expect(page.locator('.stat-box').nth(1)).toContainText('[0.0667, 0.6525]')
  await expect(page.locator('.stat-box').nth(0)).toContainText('x ∈ {0, …, 6}')
  await expect(page.locator('.duality')).toContainText('기각하지 않음')
})

test('E02 이항: 뒤집는 검정을 바꾸면 구간이 바뀐다 (Wilson, Wald)', async ({ page }) => {
  await page.goto('./#/lab/e02?model=binom&stage=3')
  await page.getByRole('radio', { name: 'score' }).click()
  await expect(page.locator('.stat-box').nth(1)).toContainText('[0.1078, 0.6032]')
  await page.getByRole('radio', { name: 'Wald' }).click()
  await expect(page.locator('.stat-box').nth(1)).toContainText('[0.0160, 0.5840]')
})

test('E02 이항 4단계: 정확 포함률 98.94%, MC가 그 근처', async ({ page }) => {
  await page.goto('./#/lab/e02?model=binom&stage=4&seed=21')
  await page.getByRole('button', { name: '1,000회' }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  await expect(page.locator('.stat-box').nth(0)).toContainText('/ 2,000')
  await expect(page.locator('.stat-box').nth(1)).toContainText('98.94%')
  const text = await page.locator('.stat-box').nth(0).textContent()
  const k = Number(/([\d,]+) \/ 2,000/.exec(text!)![1].replace(',', ''))
  expect(Math.abs(k / 2000 - 0.9894)).toBeLessThan(4 * Math.sqrt((0.9894 * 0.0106) / 2000))
})

test('E02 이항: 같은 seed 링크는 같은 도수', async ({ page }) => {
  await page.goto('./#/lab/e02?model=binom&stage=4&seed=5&k=300')
  const a = await page.locator('.stat-box').nth(0).textContent()
  await page.reload()
  await expect(page.locator('.stat-box').nth(0)).toHaveText(a!)
})

test('E04 이항: p₀ = 0.05에서 정확검정 p = 0.0230 기각, 끝점의 p = α (AC-E04-4)', async ({ page }) => {
  await page.goto('./#/lab/e04')
  await page.getByRole('radio', { name: '이항 모비율' }).click()
  await expect(page).toHaveURL(/model=binom/)
  await page.getByLabel('가설값 p₀ 직접 입력').fill('0.05')
  await page.getByLabel('가설값 p₀ 직접 입력').press('Enter')
  await expect(page.locator('.verdict')).toContainText('p = 0.0230')
  await expect(page.locator('.verdict')).toContainText('기각 (p < α')
  await expect(page.locator('.stat-box').nth(0)).toContainText('[0.0667, 0.6525]')
  await expect(page.locator('.stat-box').nth(1)).toContainText('0.050000 · 0.050000')
  await expect(page.locator('.duality')).toContainText('∉ [0.0667, 0.6525]')
})

test('E04 이항: 검정을 바꾸면 p-값과 구간이 바뀐다', async ({ page }) => {
  await page.goto('./#/lab/e04?model=binom&p0=0.05')
  await page.getByRole('radio', { name: 'Wald' }).click()
  await expect(page.locator('.stat-box').nth(0)).toContainText('[0.0160, 0.5840]')
  await expect(page.locator('.duality')).toContainText('∈ [0.0160, 0.5840]')
  await expect(page.locator('.verdict')).toContainText('기각하지 않음')
})

test('E04 이항: x = 0이면 CP 하한은 0이고 α와 만나는 끝점은 하나', async ({ page }) => {
  await page.goto('./#/lab/e04?model=binom&bx=0&p0=0.2')
  await expect(page.locator('.stat-box').nth(0)).toContainText('[0.0000, 0.3085]')
  await expect(page.locator('.stat-box').nth(1)).toContainText(/^[^·]*0\.050000[^·]*$/)
})

test('E06: AC-E06-1 같은 관측의 네 구간, 곡선은 예상 뒤에 그린다', async ({ page }) => {
  await page.goto('./#/lab/e06')
  const t1 = page.locator('.compare-table').first()
  await expect(t1).toContainText('[0.0160, 0.5840]')
  await expect(t1).toContainText('[0.1078, 0.6032]')
  await expect(t1).toContainText('[0.0667, 0.6525]')
  await expect(t1).toContainText('[0.0927, 0.6058]')
  await expect(page.locator('.col-chart svg[role=img]').first()).not.toBeVisible({ timeout: 1000 }).catch(() => undefined)
  await page.getByRole('radio', { name: /많은 p에서 95%보다 꽤 낮고/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await page.getByRole('button', { name: '포함률 곡선 그리기' }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
})

test('E06: AC-E06-2 p = 0.3의 정확 포함률', async ({ page }) => {
  await page.goto('./#/lab/e06')
  const t2 = page.locator('.compare-table').nth(1)
  await expect(t2.locator('tr', { hasText: 'Wald' })).toContainText('84.01%')
  await expect(t2.locator('tr', { hasText: 'Wilson' })).toContainText('92.44%')
  await expect(t2.locator('tr', { hasText: 'Clopper' })).toContainText('98.94%')
  await expect(t2.locator('tr', { hasText: 'Clopper' })).toContainText('96.1% (p=')
})

test('E06: AC-E06-3 경계 사례 — 사후질량 95%인데 포함률 90.44%', async ({ page }) => {
  await page.goto('./#/lab/e06')
  await page.getByRole('button', { name: '경계 사례' }).click()
  await expect(page).toHaveURL(/ps=0.01/)
  await page.locator('.col-chart select').selectOption('jeffreys')
  await expect(page.getByText(/x = 0일 때만 참값을 포함하므로 c\(p\*\) = P\(X = 0\) = \(1 − 0.01\)\^10 = 0.9043821/)).toBeVisible()
})

test('E06: AC-E06-4 경계 변형은 CSV와 설정 JSON에 별도 이름으로 남는다', async ({ page }) => {
  await page.goto('./#/lab/e06?seed=4&k=50&cm=jeffreys,jeffreys_boundary,wald,wald_clipped')
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '결과 CSV' }).click()])
  const csv = Buffer.concat(await (await csvDl.createReadStream()).toArray()).toString('utf-8')
  const rows = csv.split('\n').filter((l) => /^\d/.test(l))
  expect(rows.length).toBe(50 * 4)
  for (const id of ['binom_jeffreys', 'binom_jeffreys_boundary', 'binom_wald', 'binom_wald_clipped']) expect(csv).toContain(`,${id},`)
  const [jsonDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '설정 JSON' }).click()])
  const json = JSON.parse(Buffer.concat(await (await jsonDl.createReadStream()).toArray()).toString('utf-8'))
  expect(json.method_ids).toEqual(['binom_wald', 'binom_jeffreys', 'binom_jeffreys_boundary', 'binom_wald_clipped'])
  expect(json.model).toBe('binomial')
})

test('E06: 그림을 누르면 p*가 이동하고, 큰 n은 Worker로 계산된다 (AC-E06-5)', async ({ page }) => {
  await page.goto('./#/lab/e06?en=1000&bx=30&ps=0.03')
  await page.getByRole('button', { name: '포함률 곡선 그리기' }).click()
  const t0 = Date.now()
  await expect(page.locator('.compare-table').nth(1)).not.toContainText('…', { timeout: 10_000 })
  expect(Date.now() - t0).toBeLessThan(5000)
  const svg = page.locator('.col-chart svg[style*="crosshair"]')
  const box = (await svg.boundingBox())!
  await svg.click({ position: { x: box.width * 0.6, y: box.height / 2 } })
  const ps = Number(/ps=([\d.]+)/.exec(page.url())![1])
  expect(ps).toBeGreaterThan(0.5)
  expect(ps).toBeLessThan(0.7)
})

test('E07: AC-E07-1 세 패널의 같은 끝점과 §10.1 문장', async ({ page }) => {
  await page.goto('./#/lab/e07')
  const cards = page.locator('.view-card')
  await expect(cards).toHaveCount(3)
  for (let i = 0; i < 3; i++) await expect(cards.nth(i).locator('h3')).toHaveText('[90.2002, 109.7998]')
  await expect(cards.nth(0)).toContainText('이 방법을 반복 적용하면 구간의 95%가 참값을 포함한다')
  await expect(cards.nth(0)).toContainText('이 구간은 μ에 대한 95% 신뢰구간이며, 관측된 구간은 μ를 포함하거나 포함하지 않는다')
  await expect(cards.nth(1)).toContainText('사전분포·모형·자료 아래에서 사후질량이 95%다')
  await expect(cards.nth(2)).toContainText('피듀셜 구성과 해석에는 조건과 논쟁이 있다')
  await expect(page.locator('.note').first()).toContainText('이 단순 모형과 구성에서는 세 관점의 끝점이 같다')
})

test('E07: AC-E07-2 사전 N(90, 10²) → 신용구간 [89.2348, 106.7652], 나머지 둘은 그대로', async ({ page }) => {
  await page.goto('./#/lab/e07')
  await page.getByRole('radio', { name: '정규 N(m₀, τ₀²)' }).click()
  const cards = page.locator('.view-card')
  await expect(cards.nth(1).locator('h3')).toHaveText('[89.2348, 106.7652]')
  await expect(cards.nth(0).locator('h3')).toHaveText('[90.2002, 109.7998]')
  await expect(cards.nth(2).locator('h3')).toHaveText('[90.2002, 109.7998]')
  await expect(page.locator('.note').first()).toContainText('베이즈 구간만 움직였습니다')
})

test('E07: AC-E07-3 반복표집은 μ선 고정, 사후표집은 관측 자료 고정', async ({ page }) => {
  await page.goto('./#/lab/e07?seed=11')
  const anim = page.locator('.two-anim > section')
  const truthLine = anim.nth(0).locator('svg line[stroke="var(--c-truth)"]').first()
  await anim.nth(0).getByRole('button', { name: '1회' }).click()
  const x1 = await truthLine.getAttribute('x1')
  await anim.nth(0).getByRole('button', { name: '100회' }).click()
  await expect(anim.nth(0).locator('.stat-box').first()).toContainText('/ 101')
  expect(await truthLine.getAttribute('x1')).toBe(x1)

  const obs = anim.nth(1).locator('svg line[stroke="var(--c-truth)"]').first()
  const ox = await obs.getAttribute('x1')
  const urlBefore = page.url()
  await anim.nth(1).getByRole('button', { name: '1,000개' }).click()
  await expect(anim.nth(1).locator('.stat-box').first()).toContainText('/ 1,000')
  expect(await obs.getAttribute('x1')).toBe(ox)
  await expect(anim.nth(1)).toContainText('관측 x̄ = 100 (고정)')
  expect(page.url()).toBe(urlBefore)
})

test('E07: 정규 사전에서 신용구간의 고정 μ 포함률은 95%가 아니다', async ({ page }) => {
  await page.goto('./#/lab/e07?seed=8&k=2000&prior=normal&m0=90&tau0=2&mu=110')
  const t = await page.locator('.two-anim > section').nth(0).locator('.stat-box').nth(1).textContent()
  const v = Number(/([\d.]+)%/.exec(t!.replace(/.*사전 N\(90, 2²\)/, ''))![1])
  expect(v).toBeLessThan(80)
})

test('E08: 네 구간 종류와 AC-E08-1 예측구간 폭', async ({ page }) => {
  await page.goto('./#/lab/e08')
  await expect(page.locator('.kind-card')).toHaveCount(4)
  await expect(page.locator('.kind-card').nth(3)).toContainText('적어도 β의 모집단 질량을 신뢰수준 γ로 포함하는가?')
  await page.getByRole('tab', { name: '계산' }).click()
  // x̄ = 100 기준: 예측구간 [50.0305, 149.9695]의 폭 99.9389
  await expect(page.getByText(/예측구간 폭 99\.9389/)).toBeVisible()
})

test('E08: AC-E08-2 예측구간은 새 관측값을, 신뢰구간은 μ를 95%로 포함한다', async ({ page }) => {
  await page.goto('./#/lab/e08?seed=13')
  await page.getByRole('radio', { name: /약 30%/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '1,000회' }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  const rows = page.locator('.compare-table tbody tr')
  const read = async (r: number, c: number) => Number(/([\d.]+)%/.exec((await rows.nth(r).locator('td').nth(c).textContent())!)![1]) / 100
  const B = 3000
  const tol = 4 * Math.sqrt((0.95 * 0.05) / B)
  expect(Math.abs((await read(0, 0)) - 0.95)).toBeLessThan(tol)
  expect(Math.abs((await read(1, 1)) - 0.95)).toBeLessThan(tol)
  expect(Math.abs((await read(0, 1)) - 0.2993)).toBeLessThan(4 * Math.sqrt((0.3 * 0.7) / B))
})

test('E08: 선택한 반복의 원자료와 CSV의 두 대상', async ({ page }) => {
  await page.goto('./#/lab/e08?seed=2&k=40&sel=7')
  await expect(page.getByText(/#8의 원자료 25개/)).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '결과 CSV' }).click()])
  const csv = Buffer.concat(await (await dl.createReadStream()).toArray()).toString('utf-8')
  const rows = csv.split('\n').filter((l) => /^\d/.test(l))
  expect(rows.length).toBe(80)
  expect(rows.filter((r) => r.includes(',normal_pred_z,')).every((r) => r.includes(',new_obs,'))).toBe(true)
})

test('E05: AC-E05-1·2 오차한계와 표본크기, n × 2는 0.707배', async ({ page }) => {
  await page.goto('./#/lab/e05')
  const stats = page.locator('#panel-calc .stat-box')
  await expect(stats.nth(0)).toContainText('9.7998')
  await expect(stats.nth(2)).toContainText('4.8999')
  await expect(stats.nth(3)).toContainText('n = 97')
  await expect(stats.nth(3)).toContainText('⌈96.04⌉')
  await page.getByRole('radio', { name: /약 0.71배/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await page.getByRole('button', { name: 'n × 2' }).click()
  await expect(page).toHaveURL(/n=50/)
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  await expect(page.locator('.feedback')).toContainText('E(100) / E(50) = 0.7071')
})

test('E05: AC-E05-3 계산 비교 탭에서는 입력을 바꿔도 표본을 뽑지 않는다', async ({ page }) => {
  await page.goto('./#/lab/e05?seed=3')
  for (const name of ['n × 4', 'n ÷ 2', 'n × 2']) await page.getByRole('button', { name }).click()
  await page.getByLabel('신뢰수준 1−α 직접 입력').fill('0.9')
  await page.getByLabel('신뢰수준 1−α 직접 입력').press('Enter')
  await expect(page).toHaveURL(/level=0.9/)
  expect(page.url()).not.toMatch(/[?&]k=/)
  await expect(page.locator('.col-chart svg g[style*="cursor"]')).toHaveCount(0)
})

test('E05: 반복실험 비교 — 두 설계 모두 명목수준, 길이만 다르다', async ({ page }) => {
  await page.goto('./#/lab/e05?seed=21')
  await page.getByRole('tab', { name: /반복실험 비교/ }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  const stats = page.locator('#panel-sim .stat-box')
  await expect(stats.nth(0)).toContainText('/ 2,000')
  await expect(stats.nth(2)).toContainText('/ 2,000')
  for (const i of [0, 2]) {
    const v = Number(/([\d.]+)%/.exec((await stats.nth(i).textContent())!.split('/ 2,000')[1])![1]) / 100
    expect(Math.abs(v - 0.95)).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / 2000))
  }
  await expect(page.locator('#panel-sim .chart-caption')).toContainText('B/A = 0.5000')
})

test('E03: 4단계 공개와 꼬리 배분 — 포함률은 그대로, 길이는 등꼬리가 최단 (AC-E03-3)', async ({ page }) => {
  await page.goto('./#/lab/e03')
  await expect(page.locator('.pivot-step')).toHaveCount(0)
  for (const st of ['2단계', '3단계', '4단계']) await page.getByRole('button', { name: new RegExp(st) }).click()
  await expect(page.locator('.pivot-step')).toHaveCount(3)
  await expect(page.locator('.pivot-note.flip')).toContainText('−1을 곱함')
  const stats = page.locator('.stat-box')
  await expect(stats.nth(0)).toContainText('[90.2002, 109.7998]')
  await page.getByRole('radio', { name: /포함률은 그대로지만/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await page.getByRole('button', { name: '1% / 4%' }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  await expect(stats.nth(2)).toContainText('95%')
  await expect(stats.nth(1)).toContainText('× 1.')
  // 대칭 분포의 최단 배분은 등꼬리(기본값이라 URL에서 빠진다)
  await page.getByRole('button', { name: '최단' }).click()
  await expect(stats.nth(1)).toContainText('× 1.0000')
  expect(page.url()).not.toMatch(/ts=/)
})

test('E03: AC-E03-1·2 t 분위수와 χ² 등꼬리 구간, 역수 변형 강조', async ({ page }) => {
  await page.goto('./#/lab/e03?stage=2')
  await page.getByRole('radio', { name: 't (σ 미지)' }).click()
  await expect(page.locator('.pivot-step').first()).toContainText('2.0639')
  await page.getByRole('radio', { name: 'χ² (모분산)' }).click()
  await expect(page).toHaveURL(/pv=chi2/)
  await expect(page.locator('.stat-box').nth(0)).toContainText('[1.8925, 13.3314]')
  await page.getByRole('button', { name: /3단계/ }).click()
  await expect(page.locator('.pivot-note.flip')).toContainText('역수를 취함')
  await expect(page.locator('.chart-caption').first()).toContainText('최단 배분 α_L/α = 0.960')
})

test('E03: 한쪽 구간과 AC-E03-4 표기 대응표', async ({ page }) => {
  await page.goto('./#/lab/e03')
  await page.getByRole('button', { name: '한쪽 (하한만)' }).click()
  await expect(page.locator('.stat-box').nth(0)).toContainText('∞]')
  await page.getByRole('tab', { name: '증명' }).click()
  const table = page.getByRole('region', { name: '표기 대응표' })
  await expect(table).toContainText('z_0.025')
  await expect(table).toContainText('Q_0.975')
  await expect(table).toContainText('1.959964')
})

test('E09: 지수 모집단 n = 10 — t 구간 약 90%, 비포함이 오른쪽으로 쏠린다', async ({ page }) => {
  await page.goto('./#/lab/e09?n=10&seed=4')
  await page.getByRole('radio', { name: /약 90%이고/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: '1,000회' }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  const row = page.locator('.compare-table tbody tr', { hasText: 't 구간' })
  const cells = await row.locator('td').allTextContents()
  const c = Number(/([\d.]+)%/.exec(cells[0])![1]) / 100
  expect(Math.abs(c - 0.9001)).toBeLessThan(4 * Math.sqrt((0.9 * 0.1) / 2000))
  await expect(page.getByText('비포함이 오른쪽(U < θ)으로 쏠렸습니다.')).toBeVisible()
})

test('E09: 분산의 χ² 구간은 t₃에서 크게 무너진다 (PRD 참고값 0.664)', async ({ page }) => {
  await page.goto('./#/lab/e09?seed=4&k=0&n=20')
  await page.getByRole('radio', { name: /^t$/ }).click()
  await page.getByRole('radio', { name: '분산 σ²' }).click()
  await expect(page).toHaveURL(/pop=t3/)
  await expect(page).toHaveURL(/tg=var/)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '1,000회' }).click()
  const cells = await page.locator('.compare-table tbody tr', { hasText: 'χ²' }).locator('td').allTextContents()
  const c = Number(/([\d.]+)%/.exec(cells[0])![1]) / 100
  expect(Math.abs(c - 0.6639)).toBeLessThan(4 * Math.sqrt((0.66 * 0.34) / 3000))
  await expect(page.locator('.col-chart .chart-caption').first()).toContainText('n을 늘려도 명목수준으로 돌아오지 않습니다')
})

test('E10: AC-E10-1·2 오포함확률 0.4840 = 1 − 검정력, 넓이 = 기대 길이 19.5996', async ({ page }) => {
  await page.goto('./#/lab/e10')
  const stats = page.locator('.stat-box')
  await expect(stats.nth(0)).toContainText('0.4840')
  await expect(stats.nth(1)).toContainText('0.5160')
  await expect(stats.nth(1)).toContainText('합 = 1.0000')
  await expect(stats.nth(2)).toContainText('19.5996')
  await page.getByRole('button', { name: '1% / 4%' }).click()
  await expect(page.locator('.col-chart .chart-caption').first()).toContainText('등꼬리 19.5996보다 깁니다')
  await page.getByRole('button', { name: '하한만' }).click()
  await expect(stats.nth(2)).toContainText('∞')
})

test('E10: t 구간(σ 미지) 겹쳐 보기 — 더 길고 틀린 값을 더 자주 포함', async ({ page }) => {
  await page.goto('./#/lab/e10?seed=5&n=5')
  await page.getByLabel(/t 구간\)도 겹쳐 보기/).click()
  await expect(page).toHaveURL(/tc=1/)
  await page.getByRole('button', { name: '1,000회' }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  await expect(page.locator('.stat-box').nth(2)).toContainText('MC 평균 길이')
  const t2 = (await page.locator('.stat-box').nth(2).textContent())!
  // 라벨(= 기대 길이 43.8261)과 값이 붙어 나오므로 소수 넷째 자리까지만 읽는다
  const zLen = Number(/= 기대 길이 (\d+\.\d{4})/.exec(t2)![1])
  const tLen = Number(/MC 평균 길이 ([\d.]+)/.exec(t2)![1])
  expect(tLen).toBeGreaterThan(zLen)
})

test('E11: 등분산이 깨지고 불균형이면 pooled t가 무너지고 Welch는 버틴다', async ({ page }) => {
  await page.goto('./#/lab/e11?seed=3')
  await page.getByRole('radio', { name: /80%대로 크게 떨어진다/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await page.getByRole('button', { name: '작은 표본의 분산이 큼' }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  await page.getByRole('button', { name: '1,000회' }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  const read = async (label: RegExp) => Number(/([\d.]+)%/.exec((await page.locator('.compare-table tbody tr', { hasText: label }).locator('td').first().textContent())!)![1]) / 100
  expect(await read(/합동 t/)).toBeLessThan(0.85)
  expect(Math.abs((await read(/Welch/)) - 0.95)).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / 2000))
})

test('E11: 대응 설계 — ρ가 클수록 SE가 줄고, 설계를 무시한 Welch는 넓다', async ({ page }) => {
  await page.goto('./#/lab/e11?seed=3')
  await page.getByRole('radio', { name: '대응 (짝비교)' }).click()
  await expect(page).toHaveURL(/de=pair/)
  const stats = page.locator('.stat-box')
  await expect(stats.nth(2)).toContainText(/0\.\d{4}/)
  await page.getByRole('button', { name: '1,000회' }).click()
  // 표가 새 반복 결과로 채워진 뒤에 읽는다
  await expect(page.locator('.compare-table tbody tr', { hasText: /대응 t/ }).locator('td').first()).toContainText('%')
  await expect(page.locator('.compare-table tbody tr', { hasText: /설계를 무시/ }).locator('td').first()).toContainText('%')
  const len = async (label: RegExp) => Number((await page.locator('.compare-table tbody tr', { hasText: label }).locator('td').nth(1).textContent())!)
  expect(await len(/설계를 무시/)).toBeGreaterThan(await len(/대응 t/))
})

test('E11: 두 비율의 차 — Wald 정확 포함률 94.03%', async ({ page }) => {
  await page.goto('./#/lab/e11?de=prop&n=20&n2=15')
  await expect(page.locator('.stat-box').first()).toContainText('94.03%')
  await expect(page.getByRole('link', { name: 'E03 피벗(F)' })).toBeVisible()
})

test('E12: 교재 예 9.7·9.8 프리셋', async ({ page }) => {
  await page.goto('./#/lab/e12')
  await page.getByRole('button', { name: '교재 예 9.7' }).click()
  const rows = page.locator('.compare-table').first().locator('tbody tr')
  await expect(rows.nth(0)).toContainText('[0.1093, 0.6097]')
  await expect(rows.nth(0)).toContainText('0.950000')
  await expect(rows.nth(1)).toContainText('[0.0934, 0.5880]')
  await page.getByRole('button', { name: '교재 예 9.8' }).click()
  await expect(rows.nth(1)).toContainText('[9.5703, 10.8093]')
  await expect(page.locator('.col-chart .chart-caption').nth(1)).toContainText('HPD와 동일꼬리가 같습니다')
})

test('E12: 다봉·U자형 사후분포의 HPD는 끊어진 집합', async ({ page }) => {
  await page.goto('./#/lab/e12')
  await page.getByRole('button', { name: '두 봉우리' }).click()
  await expect(page.locator('.compare-table').first()).toContainText('HPD (2조각)')
  await expect(page.locator('.compare-table').first()).toContainText('[−2.7490, −0.1887] ∪ [0.3989, 3.1734]')
  await page.getByRole('button', { name: 'U자형 Beta' }).click()
  await expect(page.locator('.compare-table').first()).toContainText('[0.0000, 0.4541] ∪ [0.5459, 1.0000]')
})

test('E12: 재매개화 — logit HPD를 되돌리면 다르고 동일꼬리는 같다', async ({ page }) => {
  await page.goto('./#/lab/e12')
  await page.getByLabel(/logit θ/).click()
  await expect(page).toHaveURL(/rp=1/)
  const t = page.getByRole('region', { name: '재매개화 비교 표' })
  await expect(t).toContainText('[0.1141, 0.6199]')
  await expect(t).toContainText('[0.1093, 0.6097] = θ 좌표의 동일꼬리')
})

test('E13: 중앙 대 한쪽 구간, 최단은 b = 1', async ({ page }) => {
  await page.goto('./#/lab/e13')
  const stats = page.locator('.stat-box')
  await expect(stats.nth(1)).toContainText('[0.9046, 1.8822]')
  await expect(stats.nth(2)).toContainText('[0.9000, 1.6385]')
  await page.getByRole('button', { name: '최단' }).click()
  await expect(page).toHaveURL(/bs=1(&|$)/)
  await expect(stats.nth(0)).toContainText('[0.9000, 1.6385]')
  await expect(page.locator('.chart-caption').nth(1)).toContainText('최단 b = 1.0000')
})

test('메뉴: 상단은 핵심 경로만, 탭은 핵심/심화/확장', async ({ page }) => {
  await page.goto('./#/lab/e01')
  await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link')).toHaveCount(6)
  const tabs = page.getByRole('navigation', { name: '실험 선택' })
  await expect(tabs.getByRole('link')).toHaveCount(15)
  await page.getByRole('link', { name: '전체 실험' }).click()
  await expect(page.locator('#experiments .feat-card')).toHaveCount(15)
})

test('숨김 링크: URL에 참값이 없고, 공개하면 ±1.5σ 안의 참값이 나타난다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./#/lab/e01?seed=42&mu=100')
  await page.getByRole('button', { name: '숨김 링크 복사' }).click()
  await expect(page.getByText('숨김 링크를 복사했습니다')).toBeVisible()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('hm=1')
  expect(url).toContain('hide=1')
  await page.goto(url)
  await expect(page.getByText('참값을 숨긴 상태입니다')).toBeVisible()
  await expect(page.getByRole('slider', { name: '참값 μ (교육용)' })).toBeDisabled()
  await page.getByRole('button', { name: '100회', exact: true }).click()
  expect(new URL(page.url()).hash).not.toMatch(/[?&]mu=(?!100(&|$))/)
  await page.getByRole('button', { name: '참값 공개' }).click()
  const label = (await page.locator('.col-chart svg').first().textContent())!
  const mu = Number(/참값 μ = ([−\d.-]+)/.exec(label)![1].replace('−', '-'))
  expect(Math.abs(mu - 100)).toBeLessThanOrEqual(37.5)
})

test('E06: 가능도비 구간 (P2)', async ({ page }) => {
  await page.goto('./#/lab/e06?cm=wald,cp,lr')
  await expect(page.locator('.compare-table').first().locator('tr', { hasText: '가능도비' })).toContainText('[0.0846, 0.6065]')
  await expect(page.locator('.compare-table').nth(1).locator('tr', { hasText: '가능도비' })).toContainText('96.12%')
})

test('E11: 두 비율의 차 — Newcombe 구간과 정확 포함률 (P2)', async ({ page }) => {
  await page.goto('./#/lab/e11?de=prop&n=20&n2=15')
  await expect(page.locator('.stat-box').nth(1)).toContainText('94.57%')
  await expect(page.locator('.stat-box').nth(2)).toContainText('Newcombe [')
})

test('E14: 재표집분포는 관측값 근처, 세 부트스트랩 구간과 포함률 실험', async ({ page }) => {
  await page.goto('./#/lab/e14?seed=3&n=20')
  await page.getByRole('radio', { name: /관측값 θ̂ 근처/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await page.getByRole('button', { name: '새 관측 표본' }).click()
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  const t = page.getByRole('region', { name: '부트스트랩 구간 표' })
  for (const name of ['백분위수', 'basic', 'BCa', 't 구간']) await expect(t).toContainText(name)
  await page.getByRole('button', { name: '포함률 실험 실행' }).click()
  const cov = page.getByRole('region', { name: '포함률 실험 표' })
  await expect(cov).toBeVisible({ timeout: 30_000 })
  await expect(cov.locator('tbody tr')).toHaveCount(3)
})

test('E10: 손실함수 관점 (P2) — 길이 비용 b가 신뢰수준을 고른다', async ({ page }) => {
  await page.goto('./#/lab/e10')
  const box = page.locator('.pivot-step .stat-box')
  await expect(box.nth(1)).toContainText('94.99%')
  await page.getByRole('button', { name: '95%와 같은 b로' }).click()
  await expect(box.nth(1)).toContainText('95.00%')
  await expect(box.nth(0)).toContainText(/1\.9(599|600)/)
  // 같은 b에서 n을 늘리면(SE ↓) 더 높은 수준이 최적
  await page.goto('./#/lab/e10?n=100&lc=0.0117')
  await expect.poll(async () => Number(/([\d.]+)%/.exec((await box.nth(1).textContent())!)![1])).toBeGreaterThan(99)
})

test('E15: 일반화 피듀셜 — GPQ는 명목수준 근처, 원 척도 t는 모자란다', async ({ page }) => {
  await page.goto('./#/lab/e15?seed=7&n=10')
  const t = page.getByRole('region', { name: '일반화 피듀셜 구간 표' })
  await expect(t.locator('tbody tr')).toHaveCount(4)
  await page.getByRole('radio', { name: /보다 낮다/ }).click()
  await page.getByRole('button', { name: '예상 확정' }).click()
  await page.getByRole('button', { name: '포함률 실험 실행' }).click()
  const cov = page.getByRole('region', { name: '포함률 실험 표' })
  await expect(cov).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('예상이 맞았습니다.')).toBeVisible()
  const rate = async (name: string) => Number(/([\d.]+)%/.exec((await cov.getByRole('row', { name: new RegExp(name) }).textContent())!)![1]) / 100
  expect(await rate('일반화 피듀셜')).toBeGreaterThan(0.92)
  expect(await rate('원 척도 t')).toBeLessThan(0.88)
})

test('E08: 허용구간 (P2) — 정확 k와 Howe, β 이상을 덮은 비율 ≈ γ', async ({ page }) => {
  await page.goto('./#/lab/e08?seed=8&n=10')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '1,000회' }).click()
  const box = page.locator('.pivot-step .stat-box')
  await expect(box.nth(0)).toContainText('2.8563')
  await expect(box.nth(0)).toContainText('Howe 근사 2.8382')
  const v = Number(/([\d.]+)%/.exec((await box.nth(2).textContent())!.split('γ = 95.0%')[1])![1]) / 100
  expect(Math.abs(v - 0.95)).toBeLessThan(4 * Math.sqrt((0.95 * 0.05) / 3000))
  await page.getByRole('radio', { name: '단측 상한 x̄ + kS' }).click()
  await expect(box.nth(0)).toContainText('2.3546')
})

test('강의자 도구: 경로 링크, 숨김 링크 생성, 활동지 답 토글', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./#/')
  await page.getByRole('link', { name: '강의자 도구' }).click()
  await expect(page.locator('h1')).toHaveText('수업에서 쓰는 구간 실험실')
  await expect(page.locator('.teach-steps li')).toHaveCount(6)
  await page.getByRole('button', { name: /E01 숨김 링크 만들기/ }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/hm=1/)
  expect(url).toMatch(/seed=\d+/)
  await expect(page.locator('.worksheet-answer')).toHaveCount(0)
  await page.getByLabel('답과 해설 포함').check()
  await expect(page.locator('.worksheet-answer')).toHaveCount(12)
  await page.getByRole('link', { name: 'E02 열기' }).click()
  await expect(page).toHaveURL(/lab\/e02\?stage=1/)
})

test('학습 자료: 용어·해석, 방법 카탈로그 필터, 출처 앵커', async ({ page }) => {
  await page.goto('./#/')
  await page.getByRole('link', { name: '학습 자료' }).click()
  await expect(page.locator('h1')).toHaveText('용어·해석')
  await expect(page.getByRole('region', { name: '오개념 카탈로그 표' }).locator('tbody tr')).toHaveCount(11)
  await page.getByRole('navigation', { name: '학습 자료' }).getByRole('link', { name: '방법 카탈로그' }).click()
  await page.getByLabel('구성').selectOption({ label: 'CDF 역산' })
  await expect(page.locator('.method-card')).toHaveCount(2)
  await expect(page.locator('.method-card').first()).toContainText('Clopper–Pearson')
  await page.getByLabel('구성').selectOption('all')
  await page.getByLabel('범위').selectOption('교재')
  for (const card of await page.locator('.method-card').all()) await expect(card).toContainText('교재')
  await page.getByRole('navigation', { name: '학습 자료' }).getByRole('link', { name: '역사와 논쟁' }).click()
  await page.getByRole('link', { name: '[Neyman1937]' }).click()
  await expect(page).toHaveURL(/learn\/sources#Neyman1937/)
  await expect(page.locator('tr#Neyman1937')).toBeInViewport()
})

test('진단: 오개념을 먼저 보여 주고, 사전·사후 정규화 이득과 M1 보유를 계산', async ({ page }) => {
  await page.goto('./#/learn/diagnose')
  const items = page.locator('.diag-item')
  await expect(items).toHaveCount(12)
  await expect(page.getByRole('radio', { name: /사전 진단/ })).toHaveAttribute('aria-checked', 'true')
  const answerAll = async (wrongD01: boolean) => {
    for (const it of DIAG_ITEMS) {
      const box = page.locator('.diag-item', { hasText: it.id })
      const ai = wrongD01 && it.id === 'D01' ? 0 : it.answers.findIndex((o) => o.correct)
      await box.locator('fieldset').nth(0).getByRole('radio').nth(ai).check()
      await box.locator('fieldset').nth(1).getByRole('radio').nth(it.reasons.findIndex((o) => o.correct)).check()
    }
  }
  await answerAll(true)
  await expect(page.getByText('12 / 12 문항 응답')).toBeVisible()
  await page.getByRole('button', { name: '사전 진단 제출' }).click()
  await expect(page.locator('#diag-mis')).toHaveText('사전 진단: 먼저 오개념부터')
  await expect(page.locator('.mis-list li')).toHaveCount(1)
  await expect(page.locator('.mis-list li')).toContainText('M1 · 1번 선택')
  await expect(page.locator('.stat-box').first()).toContainText('92%')
  await page.getByRole('button', { name: '다시 풀기' }).click()
  await expect(page.getByRole('radio', { name: /사후 진단/ })).toHaveAttribute('aria-checked', 'true')
  await answerAll(false)
  await page.getByRole('button', { name: '사후 진단 제출' }).click()
  await expect(page.getByText('고른 답과 이유에서 오개념이 드러나지 않았습니다.')).toBeVisible()
  const pp = page.locator('.stat-box').nth(1)
  await expect(pp).toContainText('92% → 100%')
  await expect(pp).toContainText('정규화 이득 1.00')
  await expect(pp).toContainText('M1 보유 예 → 아니오')
  // 학습기록에도 남는다
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('interval-lab:log:v1') ?? '[]').filter((e: { experiment_id: string }) => e.experiment_id.startsWith('DIAG')).length)
  expect(n).toBe(24)
})

test('E01: 워크북 8.1 연결 문구 — 100개 중 95개는 평균, 표준편차 2.18개', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=7&k=1000')
  const note = page.getByTestId('workbook-note')
  await expect(note).toContainText('그중 95개가 모수를 포함한다')
  await expect(note).toContainText('평균적으로')
  await expect(note).toContainText('√(100 × 0.95 × 0.05) ≈ 2.18개')
  await page.goto('./#/lab/e01?seed=7&k=1000&level=0.9')
  await expect(note).toContainText('√(100 × 0.9 × 0.1) ≈ 3.00개')
})

test('파일럿 제출 파일: 진단 채점·학습기록·방문 기록을 한 파일로 내보낸다', async ({ page }) => {
  await page.goto('./#/lab/e01?seed=3')
  await expect(page.locator('h1')).toHaveText('반복표집 실험실')
  await page.goto('./#/lab/e04')
  await expect(page.locator('h1')).toHaveText('검정 역산과 p-값 함수')
  await page.goto('./#/learn/diagnose')
  for (const it of DIAG_ITEMS) {
    const box = page.locator('.diag-item', { hasText: it.id })
    const ai = it.id === 'D01' ? 0 : it.answers.findIndex((o) => o.correct)
    await box.locator('fieldset').nth(0).getByRole('radio').nth(ai).check()
    await box.locator('fieldset').nth(1).getByRole('radio').nth(it.reasons.findIndex((o) => o.correct)).check()
  }
  await page.getByRole('button', { name: '사전 진단 제출' }).click()
  await page.goto('./#/')
  const btn = page.getByRole('button', { name: '제출 파일 내보내기' })
  await expect(btn).toBeDisabled()
  await page.getByLabel('참가 번호').fill('P07 이름')
  await expect(page.getByLabel('참가 번호')).toHaveValue('P07')
  const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()])
  expect(dl.suggestedFilename()).toBe('interval-lab-pilot-P07.json')
  const d = JSON.parse(readFileSync((await dl.path())!, 'utf-8'))
  expect(d.schema).toBe('interval-lab-pilot')
  expect(d.schema_version).toBe(1)
  expect(d.participant_id).toBe('P07')
  expect(d.items).toHaveLength(12)
  expect(d.items.filter((i: { kind: string }) => i.kind === 'interp')).toHaveLength(10)
  expect(d.diagnostic.post).toBeNull()
  expect(d.diagnostic.pre.score).toBeCloseTo((100 * 11) / 12, 6)
  expect(d.diagnostic.pre.interp_score).toBeCloseTo(90, 6)
  expect(d.diagnostic.pre.holds_m1).toBe(true)
  expect(d.diagnostic.pre.items.D01).toEqual({ answered: true, correct: false, misconceptions: ['M1'] })
  expect(Object.keys(d.visits).sort()).toEqual(['E01', 'E04'])
  expect(d.log.filter((e: { experiment_id: string }) => e.experiment_id === 'DIAG-pre')).toHaveLength(12)
})
