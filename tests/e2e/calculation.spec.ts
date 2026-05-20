import { test, expect } from '@playwright/test'

test.describe('確率計算 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('成功率 50 を入力して計算ボタンを押すと 4回 が表示される', async ({ page }) => {
    await page.getByLabel('成功率').fill('50')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('4回')
  })

  test('成功率 1 を入力して計算ボタンを押すと 230回 が表示される', async ({ page }) => {
    await page.getByLabel('成功率').fill('1')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('230回')
  })

  test('成功率 100 を入力するとフィールドエラーが表示され結果は表示されない', async ({ page }) => {
    const input = page.getByLabel('成功率')
    await input.fill('100')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('0より大きく100未満の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('成功率 0 を入力するとフィールドエラーが表示され結果は表示されない', async ({ page }) => {
    const input = page.getByLabel('成功率')
    await input.fill('0')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('0より大きく100未満の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('目標成功回数 2 + 成功率 50 で 7回 と「（2個獲得）」が表示される', async ({ page }) => {
    await page.getByLabel('成功率').fill('50')
    const target = page.getByLabel('目標成功回数')
    await target.fill('2')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('7回')
    await expect(page.getByRole('status')).toContainText('（2個獲得）')
  })

  test('目標成功回数 0 を入力するとフィールドエラーが表示され結果は出ない', async ({ page }) => {
    const target = page.getByLabel('目標成功回数')
    await target.fill('0')
    await page.getByLabel('成功率').fill('50')
    await target.blur()
    await expect(target).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('目標成功回数は1以上を指定してください。')).toBeVisible()
    await expect(page.getByRole('button', { name: '計算' })).toBeDisabled()
  })

  test('目標成功回数 101 を入力するとエラー「100以下」が表示される', async ({ page }) => {
    const target = page.getByLabel('目標成功回数')
    await target.fill('101')
    await target.blur()
    await expect(target).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('目標成功回数は100以下を指定してください。')).toBeVisible()
  })
})

test.describe('逆算 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: '逆算' }).click()
  })

  test('逆算タブをクリックすると aria-selected が切替わる', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '逆算' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: '順算' })).toHaveAttribute('aria-selected', 'false')
  })

  test('成功率 50 + 試行回数 4 で 93.75% が表示される', async ({ page }) => {
    await page.getByLabel('成功率').fill('50')
    await page.getByLabel('試行回数').fill('4')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('93.75%')
    await expect(page.getByRole('status')).toContainText('4回試行したとき少なくとも1回成功する確率')
  })

  test('成功率 0 を入力するとフィールドエラーが表示され結果は出ない', async ({ page }) => {
    const input = page.getByLabel('成功率')
    await input.fill('0')
    await page.getByLabel('試行回数').fill('4')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('0より大きく100未満の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('試行回数 0 を入力するとフィールドエラーが表示され結果は出ない', async ({ page }) => {
    const input = page.getByLabel('試行回数')
    await page.getByLabel('成功率').fill('50')
    await input.fill('0')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('試行回数は1以上を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})

test.describe('天井UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('「天井を考慮する」Switch が初期 OFF、ON クリックで天井入力欄が表示される', async ({ page }) => {
    const sw = page.getByRole('switch', { name: '天井を考慮する' })
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByLabel('天井回数')).toHaveCount(0)

    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('天井回数')).toBeVisible()
    await expect(page.getByLabel('天井すり抜け率')).toBeVisible()
  })

  test('Switch ON + 成功率 1 + 天井 100 + すり抜け率 0 で「100回」+ 補助文言', async ({ page }) => {
    await page.getByRole('switch', { name: '天井を考慮する' }).click()
    await page.getByLabel('成功率').fill('1')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('100回')
    await expect(page.getByRole('status')).toContainText('天井 100 回・すり抜け率 0% 込み')
  })

  test('Switch ON + すり抜け率 -1 でエラー文言が表示され計算ボタン disabled', async ({ page }) => {
    await page.getByRole('switch', { name: '天井を考慮する' }).click()
    const slip = page.getByLabel('天井すり抜け率')
    await slip.fill('-1')
    await slip.blur()
    await expect(slip).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('0以上100以下の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('button', { name: '計算' })).toBeDisabled()
  })
})

test.describe('累積確率グラフ E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('計算前はグラフが描画されない', async ({ page }) => {
    await expect(page.locator('[data-testid="probability-chart"]')).toHaveCount(0)
  })

  test('計算実行後にグラフが描画される（成功率50で svg + 90%補助線ラベル）', async ({ page }) => {
    await page.getByLabel('成功率').fill('50')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.locator('[data-testid="probability-chart"] svg')).toBeVisible()
    // 信頼度 90 の破線ラベル「90%」が SVG 内に存在
    await expect(
      page.locator('[data-testid="probability-chart"] text').filter({ hasText: '90%' }).first(),
    ).toBeVisible()
  })

  test('成功率 0 でエラー時はグラフが描画されない', async ({ page }) => {
    await page.getByLabel('成功率').fill('0')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.locator('[data-testid="probability-chart"]')).toHaveCount(0)
  })
})
