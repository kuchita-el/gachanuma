import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ForwardForm } from './forward-form'
import { ErrorBoundary } from '@/lib/test/error-boundary-test-helper'
import { calculateTrialCountForMultipleSuccess } from '@/probability/required-trials'
import { calculateTrialCountWithPity } from '@/probability/required-trials-with-pity'
import { makeDomainErrResult } from '@/lib/test/make-domain-err-result'
import { STALE_RESULT_NOTICE } from './result-panel'

vi.mock('@/probability/required-trials', async (importOriginal) => {
  const actual
    = await importOriginal<typeof import('@/probability/required-trials')>()
  return {
    ...actual,
    calculateTrialCountForMultipleSuccess: vi.fn(
      actual.calculateTrialCountForMultipleSuccess,
    ),
  }
})

vi.mock('@/probability/required-trials-with-pity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/probability/required-trials-with-pity')>()
  return {
    ...actual,
    calculateTrialCountWithPity: vi.fn(actual.calculateTrialCountWithPity),
  }
})

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-path'),
}))

const isErrorBoundaryLogFor = (
  call: unknown[],
  expected: { pathname: string, name: string },
): boolean =>
  call[0] === '[error-boundary]'
  && typeof call[1] === 'object'
  && call[1] !== null
  && (call[1] as { pathname?: unknown }).pathname === expected.pathname
  && (call[1] as { name?: unknown }).name === expected.name

/**
 * 計算ボタンを押したとき、対象フィールドがエラーになりフォーカスされ、結果が表示されないことを検証する（Issue #21）。
 * 計算ボタンは常に押せるため、不正入力は react-hook-form の既定動作（最初のエラーフィールドへフォーカス）で伝える。
 */
async function expectSubmitBlockedWithFocus(
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
) {
  const submit = screen.getByRole('button', { name: '計算' })
  expect(submit).toBeEnabled()
  await user.click(submit)
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveFocus()
  expect(screen.queryByRole('status', { name: '計算結果' })).not.toBeInTheDocument()
}

describe('ForwardForm', () => {
  it('成功率ラベルと入力欄が表示される', () => {
    render(<ForwardForm />)
    expect(screen.getByLabelText('成功率')).toBeInTheDocument()
  })

  it('成功率 50 を入力して計算ボタンを押すと 4回 が結果領域に表示される', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('4回')
    expect(status).toHaveTextContent('90%の確率で少なくとも1回成功するために必要な試行回数')
  })

  it('成功率 10 を入力して計算ボタンを押すと 22回 が表示される', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    await user.type(screen.getByLabelText('成功率'), '10')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('22回')
  })

  it('成功率 1 を入力して計算ボタンを押すと 230回 が表示される（percentToRatio 結線の検証）', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    await user.type(screen.getByLabelText('成功率'), '1')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('230回')
  })

  it('成功率 99 を入力して計算ボタンを押すと 1回 が表示される（高成功率境界）', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    await user.type(screen.getByLabelText('成功率'), '99')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('1回')
  })

  it('成功率 0 を入力してフォーカスアウトすると境界値エラーが表示される', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '0')
    await user.tab()
    expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('成功率 100 を入力してフォーカスアウトすると境界値エラーが表示される', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '100')
    await user.tab()
    expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('結果領域に role="status" / aria-live="polite" が付与される', async () => {
    const user = userEvent.setup()
    render(<ForwardForm />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('Input に inputmode=decimal / type=text / aria-describedby が付与される', () => {
    render(<ForwardForm />)
    const input = screen.getByLabelText('成功率')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).not.toHaveAttribute('step')
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('aria-describedby がヘルパーテキスト要素の id と連結される', () => {
    render(<ForwardForm />)
    const input = screen.getByLabelText('成功率')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    const helper = document.getElementById(describedBy!)
    expect(helper).not.toBeNull()
    expect(helper).toHaveTextContent('0より大きく100未満の数値を入力してください')
  })

  describe('信頼度UI', () => {
    it('信頼度ラベルと入力欄が表示され、初期値は 90 である', () => {
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('90')
    })

    it('プリセット 5 個（50/75/90/95/99）が描画される', () => {
      render(<ForwardForm />)
      for (const preset of [50, 75, 90, 95, 99]) {
        expect(screen.getByRole('button', { name: `${preset}%` })).toBeInTheDocument()
      }
    })

    it('プリセットのボタン群が「信頼度のプリセット」という名前の group になる（Issue #25）', () => {
      render(<ForwardForm />)
      const group = screen.getByRole('group', { name: '信頼度のプリセット' })
      for (const preset of [50, 75, 90, 95, 99]) {
        expect(within(group).getByRole('button', { name: `${preset}%` })).toBeInTheDocument()
      }
    })

    it('信頼度の説明文に、意味（求めた回数以内に目標を達成できる確率）と入力規則が表示される（Issue #18）', () => {
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      const helper = document.getElementById(input.getAttribute('aria-describedby')!.split(' ')[0]!)
      expect(helper).toHaveTextContent('求めた回数以内に目標を達成できる確率です。')
      expect(helper).toHaveTextContent('0より大きく100未満の整数を入力してください')
    })

    it('初期表示時、プリセット 90 が aria-pressed=true で選択状態', () => {
      render(<ForwardForm />)
      expect(screen.getByRole('button', { name: '90%' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '50%' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('プリセット 75 をクリックすると信頼度フィールドが 75 に更新される（片方向同期）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('button', { name: '75%' }))
      const input = screen.getByLabelText('信頼度') as HTMLInputElement
      expect(input.value).toBe('75')
      expect(screen.getByRole('button', { name: '75%' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '90%' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('成功率 10 + 信頼度 50 で計算すると 7回 と 50%文言が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '50%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('50%の確率で少なくとも1回成功するために必要な試行回数')
    })

    it('成功率 0.01 + 信頼度 99 で計算すると 1,000 以上の回数が桁区切りで「46,050回」と表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '0.01')
      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('46,050回')
    })

    it('成功率 10 + 信頼度 99 で計算すると 44回 と 99%文言が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('44回')
      expect(status).toHaveTextContent('99%の確率で少なくとも1回成功するために必要な試行回数')
    })

    it('信頼度 7（ratio 往復で誤差が出る値）でも結果文言は「7%」が厳密表示される（浮動小数点ドリフト回帰）', async () => {
      // 7/100*100 は 7.000000000000001 になるため、ratio 逆変換だと「7.000000000000001%」と崩れる。
      // 表示 percent は生入力から取得するため厳密な「7%」になることを担保する。
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      const confidence = screen.getByLabelText('信頼度')
      await user.clear(confidence)
      await user.type(confidence, '7')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7%の確率で少なくとも1回成功するために必要な試行回数')
      expect(status).not.toHaveTextContent('7.000000000000001')
    })

    it('全角数字（成功率 "５０" / 信頼度 "９９"）でも半角と同じ結果が表示される（Issue #13: type="text" 化の全角正規化）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '５０')
      const confidence = screen.getByLabelText('信頼度')
      await user.clear(confidence)
      await user.type(confidence, '９９')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('99%の確率で少なくとも1回成功するために必要な試行回数')
      expect(status).not.toHaveTextContent('NaN')
    })

    it('信頼度 0 でフォーカスアウトするとエラー文言と aria-invalid → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('信頼度 100 でフォーカスアウトするとエラー文言 → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '100')
      await user.tab()
      expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('信頼度 90.5（非整数）でエラー文言 → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '90.5')
      await user.tab()
      expect(await screen.findByText('整数を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('信頼度を空欄にすると数値エラー文言 → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.tab()
      expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('成功率 0 で計算ボタンを押すと成功率にフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('成功率')
      await user.type(input, '0')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('計算ボタンの押し下げでは入力欄のフォーカスを奪わない（押下中の検証でボタンがずれ、クリックが無視されるのを防ぐ）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const successRate = screen.getByLabelText('成功率')
      await user.type(successRate, '50')
      await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: '計算' }) })
      expect(successRate).toHaveFocus()
      expect(successRate).toHaveAttribute('aria-invalid', 'false')
    })

    it('計算ボタンは入力が不正でも常に押せる（Issue #21）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const confidence = screen.getByLabelText('信頼度')
      await user.clear(confidence)
      await user.tab()
      expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '計算' })).toBeEnabled()
    })

    it('複数のフィールドが不正なとき、最初のエラーフィールド（成功率）にフォーカスが移る（Issue #21）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const confidence = screen.getByLabelText('信頼度')
      await user.clear(confidence)
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(screen.getByLabelText('成功率')).toHaveFocus()
      expect(confidence).toHaveAttribute('aria-invalid', 'true')
    })

    it('成功率 10 + 信頼度デフォルト 90 で計算すると 22回 と 90%文言が表示される（AC3 中央値）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('22回')
      expect(status).toHaveTextContent('90%の確率で少なくとも1回成功するために必要な試行回数')
    })

    it('信頼度 50 で計算後、信頼度 99 に変更して再計算すると結果文言が 99% に更新される（状態遷移）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '50%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      let status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('50%の確率で少なくとも1回成功するために必要な試行回数')

      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('44回')
      expect(status).toHaveTextContent('99%の確率で少なくとも1回成功するために必要な試行回数')
    })

    it('信頼度フィールドを直接 75 に編集するとプリセット 75 の aria-pressed が true になる（表示双方向）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '75')
      expect(screen.getByRole('button', { name: '75%' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '90%' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('信頼度フィールドに全角 "７５" を入力してもプリセット 75 の aria-pressed が true になる（Issue #13）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '７５')
      expect(screen.getByRole('button', { name: '75%' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('aria-describedby は初期描画で 1 id、エラー時は description + message の 2 id 連結', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      const initialIds = input.getAttribute('aria-describedby')!.split(' ')
      expect(initialIds).toHaveLength(1)
      expect(document.getElementById(initialIds[0]!)).toHaveTextContent('0より大きく100未満の整数を入力してください')

      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      const erroredIds = input.getAttribute('aria-describedby')!.split(' ')
      expect(erroredIds).toHaveLength(2)
      const texts = erroredIds.map(id => document.getElementById(id)?.textContent ?? '')
      expect(texts.some(t => t.includes('0より大きく100未満の整数を入力してください'))).toBe(true)
      expect(texts.some(t => t.includes('0より大きく100未満の数値を指定してください'))).toBe(true)
    })
  })

  describe('目標成功回数 UI', () => {
    it('目標成功回数ラベルと入力欄が表示され、初期値は 1 である', () => {
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('1')
    })

    it('目標成功回数 input に inputmode=numeric / type=text が付与され step / min / max は付与されない', () => {
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      expect(input).toHaveAttribute('inputmode', 'numeric')
      expect(input).toHaveAttribute('type', 'text')
      expect(input).not.toHaveAttribute('step')
      expect(input).not.toHaveAttribute('min')
      expect(input).not.toHaveAttribute('max')
    })

    it('目標成功回数 1（既定）+ 成功率 50 で「4回」「90%文言」（既存挙動の回帰）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('4回')
      expect(status).toHaveTextContent('90%の確率で少なくとも1回成功するために必要な試行回数')
      expect(status).not.toHaveTextContent('回以上成功')
    })

    it('目標成功回数 2 + 成功率 50 で「7回」「2回以上成功する」説明文（Issue #26）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      const target = screen.getByLabelText('目標成功回数')
      await user.clear(target)
      await user.type(target, '2')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('90%の確率で2回以上成功するために必要な試行回数')
      expect(status).not.toHaveTextContent('獲得')
    })

    it('目標成功回数 10 + 成功率 50 で計算結果が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      const target = screen.getByLabelText('目標成功回数')
      await user.clear(target)
      await user.type(target, '10')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent(/\d+回/)
      expect(status).toHaveTextContent('90%の確率で10回以上成功するために必要な試行回数')
    })

    it('目標成功回数 0 でフォーカスアウト → aria-invalid + エラー文言 → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(await screen.findByText('目標成功回数は1以上を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('目標成功回数 101 でフォーカスアウト → エラー文言「100以下」→ 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '101')
      await user.tab()
      expect(await screen.findByText('目標成功回数は100以下を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('目標成功回数 1.5（非整数）でフォーカスアウト → エラー文言「整数」→ 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '1.5')
      await user.tab()
      expect(await screen.findByText('目標成功回数は整数を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('目標成功回数 -1 でフォーカスアウト → エラー文言「1以上」→ 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '-1')
      await user.tab()
      expect(await screen.findByText('目標成功回数は1以上を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('目標成功回数空欄でフォーカスアウト → 数値エラー文言 → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.tab()
      expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })
  })

  describe('天井UI', () => {
    it('「天井を考慮する」Switch が描画され初期 OFF（aria-checked=false）', () => {
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      expect(sw).toBeInTheDocument()
      expect(sw).toHaveAttribute('aria-checked', 'false')
    })

    it('初期表示では天井入力欄が非表示', () => {
      render(<ForwardForm />)
      expect(screen.queryByLabelText('天井回数')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('天井すり抜け率')).not.toBeInTheDocument()
    })

    it('Switch をクリックすると aria-checked=true になり天井入力欄が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByLabelText('天井回数')).toBeInTheDocument()
      expect(screen.getByLabelText('天井すり抜け率')).toBeInTheDocument()
    })

    it('Switch ON → OFF で天井入力欄が再び非表示になる', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      expect(screen.getByLabelText('天井回数')).toBeInTheDocument()
      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'false')
      expect(screen.queryByLabelText('天井回数')).not.toBeInTheDocument()
    })

    it('Switch ON + 成功率 1 + 天井 100 + すり抜け率 0 で「100回」と補助文言が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('100回')
      expect(status).toHaveTextContent('天井 100 回・すり抜け率 0% 込み')
    })

    it('Switch ON + 成功率 0.01 + 天井 1000 で試行回数・天井回数が桁区切りで表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '0.01')
      const pityCount = screen.getByLabelText('天井回数')
      await user.clear(pityCount)
      await user.type(pityCount, '1000')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('1,000回')
      expect(status).toHaveTextContent('天井 1,000 回・すり抜け率 0% 込み')
    })

    it('Switch OFF で計算しても補助文言「天井 N 回・すり抜け率 M% 込み」は表示されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).not.toHaveTextContent('天井')
    })

    it('Switch ON で天井回数 0 を入力するとエラー文言 + aria-invalid → 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      const input = screen.getByLabelText('天井回数')
      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(await screen.findByText('天井回数は1以上を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('Switch ON ですり抜け率 -1 を入力するとエラー文言「0以上100以下」→ 計算ボタンを押すとそのフィールドにフォーカスが移り計算されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      // 成功率を有効にしておき、エラーのある対象フィールドが最初のエラーになるようにする
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      const input = screen.getByLabelText('天井すり抜け率')
      await user.clear(input)
      await user.type(input, '-1')
      await user.tab()
      expect(await screen.findByText('0以上100以下の数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      await expectSubmitBlockedWithFocus(user, input)
    })

    it('Switch ON ですり抜け率 0 と 100 は境界値として受理される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      const input = screen.getByLabelText('天井すり抜け率')

      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(input).toHaveAttribute('aria-invalid', 'false')

      await user.clear(input)
      await user.type(input, '100')
      await user.tab()
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('Switch ON + 成功率 50 + 天井 4 + すり抜け率 100 で 5 回（kNoPity==N 境界、m=1 で k=N+1）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '50')
      const pity = screen.getByLabelText('天井回数')
      await user.clear(pity)
      await user.type(pity, '4')
      const slip = screen.getByLabelText('天井すり抜け率')
      await user.clear(slip)
      await user.type(slip, '100')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('5回')
    })

    it('Switch ON で天井回数に不正値→OFF にすると天井回数のエラーで計算が妨げられない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      const pity = screen.getByLabelText('天井回数')
      await user.clear(pity)
      await user.type(pity, '0')
      await user.tab()

      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'false')
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('status', { name: '計算結果' })).toBeInTheDocument()
    })

    it('Switch ON + 目標成功回数 3 で計算しても説明文は「少なくとも1回成功」になる（天井計算は1回成功前提、Issue #26）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const target = screen.getByLabelText('目標成功回数')
      await user.clear(target)
      await user.type(target, '3')
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('100回')
      expect(status).toHaveTextContent('90%の確率で少なくとも1回成功するために必要な試行回数')
      expect(status).not.toHaveTextContent('3回以上')
    })

    it('Switch ON で目標成功回数が disabled になり、補足文が天井用に切り替わる（Issue #12）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const target = screen.getByLabelText('目標成功回数')
      expect(target).not.toBeDisabled()
      expect(screen.getByText('何回成功したいかです。1〜100 の整数を入力してください')).toBeInTheDocument()

      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      expect(target).toBeDisabled()
      expect(screen.getByText('天井を考慮する場合は、目標成功回数は1回で計算します')).toBeInTheDocument()
      expect(screen.queryByText(/1〜100 の整数を入力してください/)).not.toBeInTheDocument()
    })

    it('目標成功回数が不正値のまま Switch ON にすると、エラー表示が消え天井計算ができる（Issue #12）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const target = screen.getByLabelText('目標成功回数')
      await user.clear(target)
      await user.type(target, '0')
      await user.tab()
      expect(await screen.findByText('目標成功回数は1以上を指定してください。')).toBeInTheDocument()

      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      expect(screen.queryByText('目標成功回数は1以上を指定してください。')).not.toBeInTheDocument()
      expect(target).toHaveAttribute('aria-invalid', 'false')

      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('100回')
    })

    it('Switch ON → OFF で目標成功回数が再び入力可能になり、入力値が復元される（Issue #12）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const target = screen.getByLabelText('目標成功回数') as HTMLInputElement
      await user.clear(target)
      await user.type(target, '5')
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      expect(target).toBeDisabled()
      await user.click(sw)
      expect(target).not.toBeDisabled()
      expect(target.value).toBe('5')
    })

    it('Switch ON で天井回数に不正値→OFF→submit で計算が成立する（shouldUnregister による隠れたバリデーション解除）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      const pity = screen.getByLabelText('天井回数')
      await user.clear(pity)
      await user.type(pity, '0')
      await user.tab()

      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'false')
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      // 通常計算(成功率50, 信頼度90, 目標成功回数1) → 4回
      expect(status).toHaveTextContent('4回')
    })
  })

  describe('古い結果の表示（Issue #9）', () => {
    async function calculateWithSuccessRate50(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('4回')
      return status
    }

    it('計算直後は結果が薄表示されず、注記も表示されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await calculateWithSuccessRate50(user)
      expect(screen.getByTestId('result-panel-body')).not.toHaveClass('opacity-50')
      expect(screen.queryByText(STALE_RESULT_NOTICE)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'この入力で再計算' })).not.toBeInTheDocument()
    })

    it('計算後に入力を変更すると、結果とグラフが薄表示になり、注記と「この入力で再計算」が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const status = await calculateWithSuccessRate50(user)
      await user.type(screen.getByLabelText('成功率'), '0')

      expect(status).toHaveTextContent(STALE_RESULT_NOTICE)
      expect(status).toHaveTextContent('4回')
      expect(screen.getByTestId('result-panel-body')).toHaveClass('opacity-50')
      expect(screen.getByTestId('probability-chart-container')).toHaveClass('opacity-50')
      expect(screen.getByRole('button', { name: 'この入力で再計算' })).toBeInTheDocument()
    })

    it('「この入力で再計算」を押すと新しい入力で計算され、薄表示と注記が消える', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await calculateWithSuccessRate50(user)
      const successRate = screen.getByLabelText('成功率')
      await user.clear(successRate)
      await user.type(successRate, '10')
      await user.click(screen.getByRole('button', { name: 'この入力で再計算' }))

      const status = screen.getByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('22回')
      expect(status).not.toHaveTextContent(STALE_RESULT_NOTICE)
      expect(screen.getByTestId('result-panel-body')).not.toHaveClass('opacity-50')
      expect(screen.getByTestId('probability-chart-container')).not.toHaveClass('opacity-50')
    })

    it('入力をエラー値にして「この入力で再計算」を押すと、エラーフィールドにフォーカスが移り、古い結果は薄表示のまま残る', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await calculateWithSuccessRate50(user)
      const successRate = screen.getByLabelText('成功率')
      await user.clear(successRate)
      await user.type(successRate, '100')
      await user.click(screen.getByRole('button', { name: 'この入力で再計算' }))

      expect(successRate).toHaveAttribute('aria-invalid', 'true')
      expect(successRate).toHaveFocus()
      const status = screen.getByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('4回')
      expect(status).toHaveTextContent(STALE_RESULT_NOTICE)
      expect(screen.getByTestId('result-panel-body')).toHaveClass('opacity-50')
    })

    it('天井スイッチの ON/OFF でも古い結果として表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const status = await calculateWithSuccessRate50(user)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      expect(status).toHaveTextContent(STALE_RESULT_NOTICE)
    })

    it('信頼度プリセットの変更でも古い結果として表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const status = await calculateWithSuccessRate50(user)
      await user.click(screen.getByRole('button', { name: '99%' }))
      expect(status).toHaveTextContent(STALE_RESULT_NOTICE)
    })
  })

  describe('計算後の結果へのスクロール（Issue #19）', () => {
    let scrollIntoView: MockInstance<Element['scrollIntoView']>

    beforeEach(() => {
      // jsdom の scrollIntoView は vitest.setup.ts で補った no-op。呼び出しを監視する
      scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    })

    afterEach(() => {
      scrollIntoView.mockRestore()
    })

    it('初期表示ではスクロールしない', () => {
      render(<ForwardForm />)
      expect(scrollIntoView).not.toHaveBeenCalled()
    })

    it('計算すると結果パネルを含む領域へ block: nearest でスクロールする（フォーカスは移さない）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const successRate = screen.getByLabelText('成功率')
      await user.type(successRate, '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }))
      expect(scrollIntoView.mock.contexts[0]).toContainElement(status)
      // 結果パネルへフォーカスは移さない（計算ボタンは押し下げでフォーカスを奪わないため、入力欄に残る）
      expect(successRate).toHaveFocus()
    })

    it('同じ入力で再計算しても毎回スクロールする', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(scrollIntoView).toHaveBeenCalledTimes(2)
    })

    it('入力変更（古い結果の表示）ではスクロールせず、「この入力で再計算」ではスクロールする', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(scrollIntoView).toHaveBeenCalledTimes(1)

      const successRate = screen.getByLabelText('成功率')
      await user.clear(successRate)
      await user.type(successRate, '10')
      expect(await screen.findByText(STALE_RESULT_NOTICE)).toBeInTheDocument()
      expect(scrollIntoView).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: 'この入力で再計算' }))
      expect(scrollIntoView).toHaveBeenCalledTimes(2)
    })

    it('ドメインエラー時はエラー Alert を含む領域へスクロールする', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('ドメインエラー（テスト用）'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const alert = await screen.findByRole('alert')
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.contexts[0]).toContainElement(alert)
    })

    it('エラー Alert は role="alert" のみで、冗長な aria-live を併記しない（Issue #25）', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('ドメインエラー（テスト用）'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).not.toHaveAttribute('aria-live')
    })

    it('入力エラーで計算されなかったときはスクロールしない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '0')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(scrollIntoView).not.toHaveBeenCalled()
    })
  })

  describe('想定外エラー時のフォールバック表示', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('目標成功回数を指定した計算で想定外エラーが発生したときフォールバック UI に切り替わる', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockImplementationOnce(
        () => {
          throw new TypeError('boom')
        },
      )
      const user = userEvent.setup()
      render(
        <ErrorBoundary>
          <ForwardForm />
        </ErrorBoundary>,
      )
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(
        await screen.findByText(/予期しないエラーが発生しました/),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('status', { name: '計算結果' }),
      ).not.toBeInTheDocument()
      expect(
        consoleErrorSpy.mock.calls.some(
          (call: unknown[]) =>
            isErrorBoundaryLogFor(call, { pathname: '/test-path', name: 'TypeError' }),
        ),
      ).toBe(true)
    })

    it('天井ありの計算で想定外エラーが発生したときフォールバック UI に切り替わる', async () => {
      vi.mocked(calculateTrialCountWithPity).mockImplementationOnce(() => {
        throw new TypeError('boom')
      })
      const user = userEvent.setup()
      render(
        <ErrorBoundary>
          <ForwardForm />
        </ErrorBoundary>,
      )
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(
        await screen.findByText(/予期しないエラーが発生しました/),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('status', { name: '計算結果' }),
      ).not.toBeInTheDocument()
      expect(
        consoleErrorSpy.mock.calls.some(
          (call: unknown[]) =>
            isErrorBoundaryLogFor(call, { pathname: '/test-path', name: 'TypeError' }),
        ),
      ).toBe(true)
    })

    it('ドメインエラーはフォールバックではなくフォーム内 Alert で表示される', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('ドメインエラー（テスト用）'),
      )
      const user = userEvent.setup()
      render(
        <ErrorBoundary>
          <ForwardForm />
        </ErrorBoundary>,
      )
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(
        await screen.findByText('ドメインエラー（テスト用）'),
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/予期しないエラーが発生しました/),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('status', { name: '計算結果' }),
      ).not.toBeInTheDocument()
    })

    it('天井ありの計算でドメインエラーが発生したときフォーム内 Alert で表示される', async () => {
      vi.mocked(calculateTrialCountWithPity).mockReturnValueOnce(
        makeDomainErrResult('天井ドメインエラー（テスト用）'),
      )
      const user = userEvent.setup()
      render(
        <ErrorBoundary>
          <ForwardForm />
        </ErrorBoundary>,
      )
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(
        await screen.findByText('天井ドメインエラー（テスト用）'),
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/予期しないエラーが発生しました/),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('status', { name: '計算結果' }),
      ).not.toBeInTheDocument()
    })

    it('fallback 表示後に再試行で復帰し、再 submit で正常結果が表示される', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockImplementationOnce(
        () => {
          throw new TypeError('boom')
        },
      )
      const user = userEvent.setup()
      render(
        <ErrorBoundary>
          <ForwardForm />
        </ErrorBoundary>,
      )
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(
        await screen.findByText(/予期しないエラーが発生しました/),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '再試行' }))
      expect(
        screen.queryByText(/予期しないエラーが発生しました/),
      ).not.toBeInTheDocument()
      expect(await screen.findByLabelText('成功率')).toHaveValue('')
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('4回')
    })
  })

  describe('入力変更時の calculationError クリア', () => {
    it('成功率を変更すると Alert が消える', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      const successRate = screen.getByLabelText('成功率')
      await user.type(successRate, '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.clear(successRate)
      await user.type(successRate, '60')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('目標成功回数を変更すると Alert が消える', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      const targetCount = screen.getByLabelText('目標成功回数')
      await user.clear(targetCount)
      await user.type(targetCount, '3')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('信頼度プリセット変更で Alert が消える', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '75%' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('天井 Switch 切替で Alert が消える', async () => {
      vi.mocked(calculateTrialCountWithPity).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(sw)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    // OFF→ON 切替は他フィールドへの副作用 (setValue 連鎖) が無いため、pityEnabled 値変化単独で購読発火することを検証する独立ケース。
    // 切替時の副作用ロジックが変わった場合、本テストの前提も再確認すること。
    it('天井 Switch OFF→ON 単独切替で Alert が消える', async () => {
      vi.mocked(calculateTrialCountForMultipleSuccess).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('天井 ON 時に天井回数を変更すると Alert が消える', async () => {
      vi.mocked(calculateTrialCountWithPity).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      const pity = screen.getByLabelText('天井回数')
      await user.clear(pity)
      await user.type(pity, '50')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('天井 ON 時にすり抜け率を変更すると Alert が消える', async () => {
      vi.mocked(calculateTrialCountWithPity).mockReturnValueOnce(
        makeDomainErrResult('テストエラー'),
      )
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      await user.type(screen.getByLabelText('成功率'), '1')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      const slip = screen.getByLabelText('天井すり抜け率')
      await user.clear(slip)
      await user.type(slip, '10')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('成功 submit 後に入力を変更しても結果カードは残り、Alert も出ない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const successRate = screen.getByLabelText('成功率')
      await user.type(successRate, '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(
        await screen.findByRole('status', { name: '計算結果' }),
      ).toBeInTheDocument()

      await user.clear(successRate)
      await user.type(successRate, '60')
      expect(
        screen.queryByRole('status', { name: '計算結果' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('累積確率グラフ統合', () => {
    it('計算未実施時はグラフが描画されない', () => {
      render(<ForwardForm />)
      expect(screen.queryByTestId('probability-chart')).not.toBeInTheDocument()
    })

    it('計算実行後にグラフが描画され結果領域の直後に配置される', async () => {
      const user = userEvent.setup()
      const { container } = render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      await screen.findByRole('status', { name: '計算結果' })
      expect(screen.getByTestId('probability-chart')).toBeInTheDocument()
      // 結果領域(role=status) を包む要素の直後の兄弟要素（薄表示用のコンテナ）の中に probability-chart が存在
      const adjacent = container.querySelector(
        'div:has(> div > [role="status"]) + [data-testid="probability-chart-container"] > [data-testid="probability-chart"]',
      )
      expect(adjacent).not.toBeNull()
    })

    it('成功率エラー時はグラフが描画されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '0')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(screen.queryByTestId('probability-chart')).not.toBeInTheDocument()
    })

    it('信頼度を変更して再計算するとグラフの破線ラベルが更新される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      await screen.findByRole('status', { name: '計算結果' })
      // 初期 c=90 → 90% ラベルが少なくとも 1 つ（プリセットボタンの「90%」と兼用、デフォルト線と重複なし）
      expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1)

      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      await screen.findByRole('status', { name: '計算結果' })
      // c=99 → 99% ラベル（プリセットボタンと破線ラベル）+ 90% デフォルト線
      // 「99%」はプリセットボタン + 破線ラベルで複数存在しうるため getAllByText
      expect(screen.getAllByText('99%').length).toBeGreaterThanOrEqual(2)
    })
  })
})
