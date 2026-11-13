import { test, expect } from '@playwright/test'

test.describe('フォント E2E', () => {
  test('html / body の font-family が Geist から始まる', async ({ page }) => {
    await page.goto('/')
    const fontFamilies = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).fontFamily,
      body: getComputedStyle(document.body).fontFamily,
    }))
    expect(fontFamilies.html).toMatch(/^"?Geist/)
    expect(fontFamilies.body).toMatch(/^"?Geist/)
  })
})
