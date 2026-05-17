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
})
