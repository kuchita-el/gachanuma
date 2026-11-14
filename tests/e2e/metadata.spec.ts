import { test, expect } from '@playwright/test'

const DESCRIPTION = 'ガチャなどの成功率から、目標の確率で成功するまでに必要な回数や、決まった回数で成功する確率を計算します。'

// Issue #24: アイコンと OGP / Twitter カード
test.describe('メタデータ E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('description と OGP / Twitter カードの文言が、ページのリード文と一致する', async ({ page }) => {
    await expect(page.getByText(DESCRIPTION)).toBeVisible()
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', DESCRIPTION)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '確率の泥沼')
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', DESCRIPTION)
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ja_JP')
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  })

  test('OGP 画像は絶対 URL で、1200×630 の PNG を取得できる', async ({ page, request }) => {
    const url = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(url).toMatch(/^https?:\/\/[^/]+\/opengraph-image\.png/)
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630')
    const response = await request.get(new URL(url!).pathname)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toBe('image/png')
  })

  test('アイコン（SVG）と Apple Touch Icon を取得できる', async ({ page, request }) => {
    for (const selector of ['link[rel="icon"][type="image/svg+xml"]', 'link[rel="apple-touch-icon"]']) {
      const href = await page.locator(selector).getAttribute('href')
      expect(href).not.toBeNull()
      const response = await request.get(href!)
      expect(response.ok()).toBe(true)
    }
  })
})
