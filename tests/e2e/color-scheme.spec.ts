import { test, expect, type Page } from '@playwright/test'

/** 要素の背景色の相対輝度（0 = 黒、1 = 白） */
async function backgroundLuminance(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    // oklch などの色指定でも、canvas に塗れば sRGB の値として読み出せる
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.fillStyle = getComputedStyle(el).backgroundColor
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)).map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  })
}

// Issue #22: ダークモードは OS の設定（prefers-color-scheme）に追従する
test.describe('配色 E2E', () => {
  test('ライトでは背景が明るい', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    expect(await backgroundLuminance(page, 'body')).toBeGreaterThan(0.8)
  })

  test('OS がダークなら背景が暗く、ヘッダーも眩しい帯にならない', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await backgroundLuminance(page, 'body')).toBeLessThan(0.05)
    expect(await backgroundLuminance(page, 'header')).toBeLessThan(0.05)
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light dark')
  })
})
