import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// PRD v2 §13·§14.6: 모든 페이지에서 WCAG 2.2 AA 위반 0건, 콘솔 오류 0건, 모바일 가로 넘침 없음
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const SEED = 'seed=12345'
export const ROUTES = [
  '#/',
  '#/lab/e01',
  `#/lab/e01?${SEED}&k=1000&sel=3`,
  `#/lab/e01?${SEED}&k=300&hide=1`,
  `#/lab/e01?${SEED}&k=200&method=t&n=5&alt=greater`,
  '#/lab/e02',
  '#/lab/e02?stage=2',
  '#/lab/e02?stage=3&xbar=108&mu0=95',
  `#/lab/e02?stage=4&${SEED}&k=500&sel=499`,
  '#/lab/e02?model=binom',
  '#/lab/e02?model=binom&stage=2&cmp=1',
  '#/lab/e02?model=binom&stage=3&bmethod=wald&bx=0',
  `#/lab/e02?model=binom&stage=4&${SEED}&k=1000&bn=30`,
  '#/lab/e04',
  '#/lab/e04?mu0=90',
  '#/lab/e04?alt=less&level=0.9&mu0=104',
  '#/lab/e04?model=binom',
  '#/lab/e04?model=binom&p0=0.05&cmp=1',
  '#/lab/e04?model=binom&bx=0&bmethod=wald',
  '#/lab/e04?model=binom&bn=60&bx=59&p0=0.9&bmethod=wilson',
  '#/lab/e06',
  `#/lab/e06?${SEED}&k=1000&bx=0&ps=0.01&cm=wald,wilson,cp,jeffreys,jeffreys_boundary`,
  '#/lab/e06?cm=agresti_coull,bayes_beta,wald_clipped&pa=2&pb=3&metric=meanLength',
  '#/lab/e06?en=400&bx=12&ps=0.03',
  '#/lab/e07',
  `#/lab/e07?${SEED}&k=500`,
  `#/lab/e07?${SEED}&k=500&prior=normal&m0=90&tau0=2&mu=110`,
  '#/lab/e03',
  '#/lab/e03?stage=4&ts=0.2',
  '#/lab/e03?pv=t&stage=4&ts=0&n=25&sd=20',
  '#/lab/e03?pv=chi2&n=10&sd=2&stage=4',
  '#/lab/e03?pv=f&n=10&sd=2&n2=8&sd2=1.5&stage=3',
  '#/lab/e05',
  '#/lab/e05?n=7&level=0.99&me=2',
  '#/lab/e08',
  `#/lab/e08?${SEED}&k=500&sel=499`,
  `#/lab/e08?${SEED}&k=300&method=t&n=5`,
  '#/lab/e09',
  `#/lab/e09?${SEED}&k=1000&n=10`,
  `#/lab/e09?${SEED}&k=500&pop=t3&tg=var&n=20`,
  `#/lab/e09?${SEED}&k=300&pop=lnorm`,
  '#/lab/e10',
  `#/lab/e10?tc=1&${SEED}&k=500`,
  '#/lab/e10?ts=0&th1=105',
  '#/lab/e11',
  `#/lab/e11?${SEED}&k=500&sigma=10&sg2=30&n2=8`,
  `#/lab/e11?de=pair&${SEED}&k=500&rho=0.8&n=12`,
  '#/lab/e11?de=prop&n=20&n2=15',
  '#/lab/e12',
  '#/lab/e12?bf=mix',
  '#/lab/e12?bf=betad&pa=0.4&pb=0.4',
  '#/lab/e12?bf=gamma&rp=1',
  '#/lab/e12?bf=normal&xbar=10.2&sigma=1&n=10&m0=0&tau0=10',
  '#/lab/e13',
  `#/lab/e13?${SEED}&k=1000&bs=1`,
  '#/lab/e14',
  `#/lab/e14?${SEED}&bst=median&pop=lnorm&bsi=3`,
  `#/lab/e01?hm=1&hide=1&${SEED}&k=200`,
  '#/lab/e06?cm=wald,wilson,cp,lr',
]

async function settle(page: Page, route: string) {
  await page.goto(`./${route}`)
  await page.locator('main h1').first().waitFor()
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  await page.waitForTimeout(300)
}

for (const route of ROUTES) {
  test(`접근성·오류 없음 ${route}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await settle(page, route)
    const res = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
    expect(errors).toEqual([])
  })
}

for (const route of ['#/', `#/lab/e02?model=binom&stage=4&${SEED}&k=500`, `#/lab/e01?${SEED}&k=1000`, '#/lab/e02?stage=3', `#/lab/e02?stage=4&${SEED}&k=200`, '#/lab/e04?mu0=90', '#/lab/e04?model=binom&p0=0.05&cmp=1', `#/lab/e06?${SEED}&k=500`, `#/lab/e07?${SEED}&k=300&prior=normal`, `#/lab/e08?${SEED}&k=300&sel=10`, '#/lab/e05', '#/lab/e03?pv=chi2&n=10&sd=2&stage=4', `#/lab/e09?${SEED}&k=300`, `#/lab/e10?tc=1&${SEED}&k=300`, `#/lab/e11?de=pair&${SEED}&k=300`, '#/lab/e12?bf=beta&rp=1', '#/lab/e13', `#/lab/e14?${SEED}`]) {
  test(`모바일: 가로 넘침 없음·접근성 ${route} @mobile`, async ({ page }) => {
    await settle(page, route)
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(page.viewportSize()!.width)
    const res = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
  })
}
