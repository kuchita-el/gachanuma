import { test, expect } from '@playwright/test'

test.describe('404 ページ E2E', () => {
  test('存在しないパスにアクセスすると日本語の 404 ページが表示され、リンクでトップに戻れる', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page).toHaveTitle('ページが見つかりません | 確率の泥沼')
    await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()

    await page.getByRole('link', { name: 'トップページへ戻る' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: '計算' })).toBeVisible()
  })
})
