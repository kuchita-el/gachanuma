import { test, expect, type Locator, type Page } from '@playwright/test'

/** モバイルで推奨されるタップ領域の下限（WCAG 2.5.5 / Apple HIG の 44px）（Issue #20） */
const MIN_TAP_SIZE = 44

const panel = (page: Page) => page.getByRole('tabpanel')

async function expectTapHeight(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE)
}

test.describe('モバイル幅（375px）のレイアウト', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('タブは全幅に等分され、文言が折り返さない（Issue #18 / #20）', async ({ page }) => {
    const list = page.getByRole('tablist')
    const tabs = [
      page.getByRole('tab', { name: '必要な回数' }),
      page.getByRole('tab', { name: '成功する確率' }),
    ]
    const listBox = (await list.boundingBox())!
    const mainBox = (await page.locator('main > div').boundingBox())!
    expect(listBox.width).toBeCloseTo(mainBox.width, 0)
    const [first, second] = await Promise.all(tabs.map(async tab => (await tab.boundingBox())!))
    expect(first!.width).toBeCloseTo(second!.width, 0)
    for (const tab of tabs) {
      // 1行に収まっていれば、テキストの高さは行の高さ程度に収まる
      const textHeight = await tab.evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return range.getBoundingClientRect().height
      })
      expect(textHeight).toBeLessThan(30)
    }
  })

  test('タブ・信頼度プリセット・天井スイッチの行・計算ボタンのタップ領域が 44px 以上（Issue #20）', async ({ page }) => {
    await expectTapHeight(page.getByRole('tab', { name: '必要な回数' }))
    const presets = panel(page).getByRole('group', { name: '信頼度のプリセット' }).getByRole('button')
    for (const preset of await presets.all()) {
      await expectTapHeight(preset)
    }
    await expectTapHeight(panel(page).getByText('天井を考慮する'))
    await expectTapHeight(panel(page).getByRole('button', { name: '計算' }))
  })

  test('計算ボタンはフォームの全幅に広がる（Issue #20）', async ({ page }) => {
    const button = (await panel(page).getByRole('button', { name: '計算' }).boundingBox())!
    const form = (await panel(page).locator('form').boundingBox())!
    expect(button.width).toBeCloseTo(form.width, 0)
  })

  test('天井スイッチの行のラベルを押すとスイッチが切り替わる（Issue #20）', async ({ page }) => {
    const toggle = panel(page).getByRole('switch', { name: '天井を考慮する' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await panel(page).getByText('天井を考慮する').click({ position: { x: 250, y: 10 } })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
})
