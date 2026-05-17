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

  test('成功率 100 を入力すると範囲外エラーが表示され結果は表示されない', async ({ page }) => {
    await page.getByLabel('成功率').fill('100')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('成功率 0 を入力すると範囲外エラーが表示され結果は表示されない', async ({ page }) => {
    await page.getByLabel('成功率').fill('0')
    await page.getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})
