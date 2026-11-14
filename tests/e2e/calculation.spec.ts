import { test, expect, type Page } from '@playwright/test'

/**
 * 表示中のタブパネル。
 * 両タブとも forceMount で常にマウントされるため（Issue #10）、「成功率」等の入力欄が DOM 上に2つ存在する。
 * getByRole は非表示要素を除外するので、表示中のパネルにスコープを絞ってから要素を探す。
 */
const panel = (page: Page) => page.getByRole('tabpanel')

test.describe('確率計算 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('成功率 50 を入力して計算ボタンを押すと 4回 が表示される', async ({ page }) => {
    await panel(page).getByLabel('成功率').fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('4回')
  })

  test('成功率 1 を入力して計算ボタンを押すと 230回 が表示される', async ({ page }) => {
    await panel(page).getByLabel('成功率').fill('1')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('230回')
  })

  test('成功率 100 を入力するとフィールドエラーが表示され結果は表示されない', async ({ page }) => {
    const input = panel(page).getByLabel('成功率')
    await input.fill('100')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(panel(page).getByText('0より大きく100未満の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('成功率 0 を入力するとフィールドエラーが表示され結果は表示されない', async ({ page }) => {
    const input = panel(page).getByLabel('成功率')
    await input.fill('0')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(panel(page).getByText('0より大きく100未満の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('目標成功回数 2 + 成功率 50 で 7回 と「2回以上成功する」説明文が表示される', async ({ page }) => {
    await panel(page).getByLabel('成功率').fill('50')
    const target = panel(page).getByLabel('目標成功回数')
    await target.fill('2')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('7回')
    await expect(page.getByRole('status')).toContainText('90%の確率で2回以上成功するために必要な試行回数')
  })

  test('目標成功回数 0 で計算ボタンを押すと、目標成功回数にフォーカスが移り結果は出ない', async ({ page }) => {
    const target = panel(page).getByLabel('目標成功回数')
    await target.fill('0')
    await panel(page).getByLabel('成功率').fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(target).toHaveAttribute('aria-invalid', 'true')
    await expect(target).toBeFocused()
    await expect(panel(page).getByText('目標成功回数は1以上を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('目標成功回数 101 を入力するとエラー「100以下」が表示される', async ({ page }) => {
    const target = panel(page).getByLabel('目標成功回数')
    await target.fill('101')
    await target.blur()
    await expect(target).toHaveAttribute('aria-invalid', 'true')
    await expect(panel(page).getByText('目標成功回数は100以下を指定してください。')).toBeVisible()
  })
})

test.describe('逆算 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: '成功する確率' }).click()
  })

  test('逆算タブをクリックすると aria-selected が切替わる', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '成功する確率' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: '必要な回数' })).toHaveAttribute('aria-selected', 'false')
  })

  test('成功率 50 + 試行回数 4 で 93.75% が表示される', async ({ page }) => {
    await panel(page).getByLabel('成功率').fill('50')
    await panel(page).getByLabel('試行回数').fill('4')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('93.75%')
    await expect(page.getByRole('status')).toContainText('4回試行したとき少なくとも1回成功する確率')
  })

  test('成功率 0 を入力するとフィールドエラーが表示され結果は出ない', async ({ page }) => {
    const input = panel(page).getByLabel('成功率')
    await input.fill('0')
    await panel(page).getByLabel('試行回数').fill('4')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(panel(page).getByText('0より大きく100未満の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('試行回数 0 を入力するとフィールドエラーが表示され結果は出ない', async ({ page }) => {
    const input = panel(page).getByLabel('試行回数')
    await panel(page).getByLabel('成功率').fill('50')
    await input.fill('0')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(panel(page).getByText('試行回数は1以上を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})

test.describe('タブ切替 E2E', () => {
  test('順算で計算 → 逆算 → 順算 と往復しても、入力値と結果が保持される（Issue #10）', async ({ page }) => {
    await page.goto('/')
    await panel(page).getByLabel('成功率').fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('4回')

    await page.getByRole('tab', { name: '成功する確率' }).click()
    await expect(panel(page).getByLabel('試行回数')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)

    await page.getByRole('tab', { name: '必要な回数' }).click()
    await expect(panel(page).getByLabel('成功率')).toHaveValue('50')
    await expect(page.getByRole('status')).toContainText('4回')
  })
})

test.describe('天井UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('「天井を考慮する」Switch が初期 OFF、ON クリックで天井入力欄が表示される', async ({ page }) => {
    const sw = page.getByRole('switch', { name: '天井を考慮する' })
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await expect(panel(page).getByLabel('天井回数')).toHaveCount(0)

    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(panel(page).getByLabel('天井回数')).toBeVisible()
    await expect(panel(page).getByLabel('天井すり抜け率')).toBeVisible()
  })

  test('Switch ON + 成功率 1 + 天井 100 + すり抜け率 0 で「100回」+ 補助文言', async ({ page }) => {
    await page.getByRole('switch', { name: '天井を考慮する' }).click()
    await panel(page).getByLabel('成功率').fill('1')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('100回')
    await expect(page.getByRole('status')).toContainText('天井 100 回・すり抜け率 0% 込み')
  })

  test('Switch ON + すり抜け率 -1 で計算ボタンを押すと、すり抜け率にフォーカスが移りエラー文言が表示される', async ({ page }) => {
    await page.getByRole('switch', { name: '天井を考慮する' }).click()
    await panel(page).getByLabel('成功率').fill('1')
    const slip = panel(page).getByLabel('天井すり抜け率')
    await slip.fill('-1')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(slip).toHaveAttribute('aria-invalid', 'true')
    await expect(slip).toBeFocused()
    await expect(panel(page).getByText('0以上100以下の数値を指定してください。')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('Switch ON で目標成功回数が disabled になり、補足文が切り替わる（Issue #12）', async ({ page }) => {
    const target = panel(page).getByLabel('目標成功回数')
    await expect(target).toBeEnabled()
    await page.getByRole('switch', { name: '天井を考慮する' }).click()
    await expect(target).toBeDisabled()
    await expect(panel(page).getByText('天井を考慮する場合は、目標成功回数は1回で計算します')).toBeVisible()
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
    await panel(page).getByLabel('成功率').fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.locator('[data-testid="probability-chart"] svg')).toBeVisible()
    // 信頼度 90 の破線ラベル「90%」が SVG 内に存在
    await expect(
      page.locator('[data-testid="probability-chart"] text').filter({ hasText: '90%' }).first(),
    ).toBeVisible()
  })

  test('成功率 0 でエラー時はグラフが描画されない', async ({ page }) => {
    await panel(page).getByLabel('成功率').fill('0')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.locator('[data-testid="probability-chart"]')).toHaveCount(0)
  })
})

test.describe('グラフのレスポンシブ表示 E2E', () => {
  // chromium プロジェクトはデスクトップ設定のみのため、テスト内で viewport を切り替えて検証する
  for (const viewportWidth of [320, 375, 640]) {
    test(`幅 ${viewportWidth}px でグラフ描画後も横スクロールが発生しない`, async ({ page }) => {
      await page.setViewportSize({ width: viewportWidth, height: 800 })
      await page.goto('/')
      await panel(page).getByLabel('成功率').fill('50')
      await panel(page).getByRole('button', { name: '計算' }).click()
      await expect(page.locator('[data-testid="probability-chart"] svg')).toBeVisible()

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(scrollWidth).toBe(innerWidth)

      // グラフがコンテンツ幅いっぱいに描画され、参照線ラベルが SVG 内に収まる
      const chartBox = await page.locator('[data-testid="probability-chart"]').boundingBox()
      const svgBox = await page.locator('[data-testid="probability-chart"] svg').first().boundingBox()
      expect(chartBox).not.toBeNull()
      expect(svgBox).not.toBeNull()
      expect(Math.abs(svgBox!.width - chartBox!.width)).toBeLessThanOrEqual(1)
      const labelBox = await page
        .locator('[data-testid="probability-chart"] text')
        .filter({ hasText: '90%' })
        .first()
        .boundingBox()
      expect(labelBox).not.toBeNull()
      expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(svgBox!.x + svgBox!.width)
    })
  }
})

// Issue #13: 数値入力欄は type="text" + inputMode で実装し、ホイール操作による値の増減を防ぐ。
test.describe('数値入力欄 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('フォーカス中にマウスホイールを操作しても入力値が変わらない', async ({ page }) => {
    const target = panel(page).getByLabel('目標成功回数')
    await target.fill('10')
    await target.hover()
    await page.mouse.wheel(0, 100)
    await page.mouse.wheel(0, -100)
    await expect(target).toBeFocused()
    await expect(target).toHaveValue('10')
  })

  test('全角数字で入力しても半角と同じ結果が表示される', async ({ page }) => {
    await panel(page).getByLabel('成功率').fill('５０')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('4回')
  })
})

// Issue #21: 入力欄からフォーカスを外さずに計算ボタンを押しても、1回目の押下で検証・フォーカス移動が起きる。
// 押し下げでフォーカスが外れると onBlur 検証のエラー表示でボタンがずれ、click が発生しなくなる不具合の回帰テスト。
test.describe('入力直後の計算ボタン押下 E2E', () => {
  for (const { label, value } of [
    { label: '成功率', value: '0' },
    { label: '信頼度', value: '0' },
    { label: '目標成功回数', value: '0' },
  ]) {
    test(`${label}に不正値を入れてそのまま計算ボタンを1回押すと、${label}にフォーカスが移る`, async ({ page }) => {
      await page.goto('/')
      if (label !== '成功率') await panel(page).getByLabel('成功率').fill('50')
      // 「信頼度」はプリセットのグループ名「信頼度のプリセット」にも部分一致するため、完全一致で探す
      const input = panel(page).getByLabel(label, { exact: true })
      await input.fill(value)
      await expect(input).toBeFocused()
      await panel(page).getByRole('button', { name: '計算' }).click()
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(input).toBeFocused()
    })
  }

  test('有効な値を入れてそのまま計算ボタンを1回押すと計算される', async ({ page }) => {
    await page.goto('/')
    await panel(page).getByLabel('成功率').fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('4回')
  })

  test('計算後に不正値を入れてそのまま「この入力で再計算」を1回押すと、その欄にフォーカスが移る', async ({ page }) => {
    await page.goto('/')
    const successRate = panel(page).getByLabel('成功率')
    await successRate.fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(page.getByRole('status')).toContainText('4回')
    await successRate.fill('100')
    await page.getByRole('button', { name: 'この入力で再計算' }).click()
    await expect(successRate).toHaveAttribute('aria-invalid', 'true')
    await expect(successRate).toBeFocused()
  })
})

// タッチで計算ボタンを押したときは、入力欄のフォーカスを外して画面のキーボードを閉じる。
// フォーカスが残るとキーボードが開いたままになり、計算結果が隠れる。
test.describe('タッチ操作での計算 E2E', () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 667 } })

  test('成功率を入力して計算ボタンをタップすると、計算され、入力欄のフォーカスが外れる', async ({ page }) => {
    await page.goto('/')
    const successRate = panel(page).getByLabel('成功率')
    await successRate.fill('50')
    await expect(successRate).toBeFocused()
    await panel(page).getByRole('button', { name: '計算' }).tap()
    await expect(page.getByRole('status')).toContainText('4回')
    await expect(successRate).not.toBeFocused()
  })

  test('不正値を入れて計算ボタンをタップすると、1回のタップでエラーの欄にフォーカスが移る', async ({ page }) => {
    await page.goto('/')
    const successRate = panel(page).getByLabel('成功率')
    await successRate.fill('0')
    await panel(page).getByRole('button', { name: '計算' }).tap()
    await expect(successRate).toHaveAttribute('aria-invalid', 'true')
    await expect(successRate).toBeFocused()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('「この入力で再計算」をタップしたときも、入力欄のフォーカスが外れる', async ({ page }) => {
    await page.goto('/')
    const successRate = panel(page).getByLabel('成功率')
    await successRate.fill('50')
    await panel(page).getByRole('button', { name: '計算' }).tap()
    await expect(page.getByRole('status')).toContainText('4回')
    await successRate.fill('10')
    await expect(successRate).toBeFocused()
    await page.getByRole('button', { name: 'この入力で再計算' }).tap()
    await expect(page.getByRole('status')).toContainText('22回')
    await expect(successRate).not.toBeFocused()
  })
})

// Issue #9: 入力変更後の古い結果の表示と、その場での再計算
test.describe('古い結果の表示 E2E', () => {
  test('計算後に入力を変更すると注記が表示され、「この入力で再計算」で新しい結果になる', async ({ page }) => {
    await page.goto('/')
    const successRate = panel(page).getByLabel('成功率')
    await successRate.fill('50')
    await panel(page).getByRole('button', { name: '計算' }).click()
    const status = page.getByRole('status')
    await expect(status).toContainText('4回')

    await successRate.fill('10')
    await expect(status).toContainText('入力が変わったため、この結果は変更前の入力のものです。')
    await expect(status).toContainText('4回')

    await page.getByRole('button', { name: 'この入力で再計算' }).click()
    await expect(status).toContainText('22回')
    await expect(status).not.toContainText('入力が変わったため')
  })
})

// Issue #19: 計算後、結果パネルが画面外にあれば画面内へスクロールする
test.describe('計算後のスクロール E2E', () => {
  test('モバイル幅（375×667）で天井 ON の計算をすると、結果パネルが画面内に入る', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.getByRole('switch', { name: '天井を考慮する' }).click()
    await panel(page).getByLabel('成功率').fill('1')
    const status = page.getByRole('status')
    await panel(page).getByRole('button', { name: '計算' }).click()
    await expect(status).toContainText('100回')
    await expect(status).toBeInViewport()
  })
})
