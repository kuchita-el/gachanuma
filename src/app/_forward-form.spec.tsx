import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ForwardForm } from './_forward-form'
import { ErrorBoundary } from '@/lib/test/error-boundary-test-helper'
import { tryCalculateTrialCountForMultipleSuccess } from '@/probability/negative-binomial'
import { tryCalculateTrialCountWithPity } from '@/probability/pity'

vi.mock('@/probability/negative-binomial', async (importOriginal) => {
  const actual
    = await importOriginal<typeof import('@/probability/negative-binomial')>()
  return {
    ...actual,
    tryCalculateTrialCountForMultipleSuccess: vi.fn(
      actual.tryCalculateTrialCountForMultipleSuccess,
    ),
  }
})

vi.mock('@/probability/pity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/probability/pity')>()
  return {
    ...actual,
    tryCalculateTrialCountWithPity: vi.fn(actual.tryCalculateTrialCountWithPity),
  }
})

const isErrorBoundaryLogForErrorName = (
  call: unknown[],
  errorName: string,
): boolean =>
  call[0] === '[error-boundary]'
  && typeof call[1] === 'object'
  && call[1] !== null
  && (call[1] as { name?: unknown }).name === errorName

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
    expect(status).toHaveTextContent('90%の確率で成功するために必要な試行回数')
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

  it('Input に inputmode=decimal / type=number / step=any / aria-describedby が付与される', () => {
    render(<ForwardForm />)
    const input = screen.getByLabelText('成功率')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('step', 'any')
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
      expect(status).toHaveTextContent('50%の確率で成功するために必要な試行回数')
    })

    it('成功率 10 + 信頼度 99 で計算すると 44回 と 99%文言が表示される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('44回')
      expect(status).toHaveTextContent('99%の確率で成功するために必要な試行回数')
    })

    it('信頼度 0 でフォーカスアウトするとエラー文言と aria-invalid と計算ボタン disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('信頼度 100 でフォーカスアウトするとエラー文言と計算ボタン disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '100')
      await user.tab()
      expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('信頼度 90.5（非整数）でエラー文言と計算ボタン disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.type(input, '90.5')
      await user.tab()
      expect(await screen.findByText('整数を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('信頼度を空欄にすると数値エラー文言と計算ボタン disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.tab()
      expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('成功率 0/100 では計算ボタン disabled にはならず（信頼度起因のみ）、submit→aria-invalid の既存フローが維持される', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const successRate = screen.getByLabelText('成功率')
      await user.type(successRate, '0')
      await user.tab()
      const submit = screen.getByRole('button', { name: '計算' })
      expect(submit).not.toBeDisabled()
      await user.click(submit)
      expect(successRate).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByRole('status', { name: '計算結果' })).not.toBeInTheDocument()
    })

    it('成功率 10 + 信頼度デフォルト 90 で計算すると 22回 と 90%文言が表示される（AC3 中央値）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('22回')
      expect(status).toHaveTextContent('90%の確率で成功するために必要な試行回数')
    })

    it('信頼度 50 で計算後、信頼度 99 に変更して再計算すると結果文言が 99% に更新される（状態遷移）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '50%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      let status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('50%の確率で成功するために必要な試行回数')

      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('44回')
      expect(status).toHaveTextContent('99%の確率で成功するために必要な試行回数')
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
  })

  describe('目標成功回数 UI', () => {
    it('目標成功回数ラベルと入力欄が表示され、初期値は 1 である', () => {
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('1')
    })

    it('目標成功回数 input に inputmode=numeric / type=number / step=1 / min=1 / max=100 が付与される', () => {
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      expect(input).toHaveAttribute('inputmode', 'numeric')
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveAttribute('step', '1')
      expect(input).toHaveAttribute('min', '1')
      expect(input).toHaveAttribute('max', '100')
    })

    it('目標成功回数 1（既定）+ 成功率 50 で「4回」「90%文言」（既存挙動の回帰）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('4回')
      expect(status).toHaveTextContent('90%の確率で成功するために必要な試行回数')
      expect(status).not.toHaveTextContent('個獲得')
    })

    it('目標成功回数 2 + 成功率 50 で「7回」「（2個獲得）」補助文言', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      const target = screen.getByLabelText('目標成功回数')
      await user.clear(target)
      await user.type(target, '2')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('（2個獲得）')
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
      expect(status).toHaveTextContent('（10個獲得）')
    })

    it('目標成功回数 0 でフォーカスアウト → aria-invalid + エラー文言 + 計算ボタン disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(await screen.findByText('目標成功回数は1以上を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('目標成功回数 101 でフォーカスアウト → エラー文言「100以下」+ disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '101')
      await user.tab()
      expect(await screen.findByText('目標成功回数は100以下を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('目標成功回数 1.5（非整数）でフォーカスアウト → エラー文言「整数」+ disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '1.5')
      await user.tab()
      expect(await screen.findByText('目標成功回数は整数を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('目標成功回数 -1 でフォーカスアウト → エラー文言「1以上」+ disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.type(input, '-1')
      await user.tab()
      expect(await screen.findByText('目標成功回数は1以上を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('目標成功回数空欄でフォーカスアウト → 数値エラー文言 + disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const input = screen.getByLabelText('目標成功回数')
      await user.clear(input)
      await user.tab()
      expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
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

    it('Switch OFF で計算しても補助文言「天井 N 回・すり抜け率 M% 込み」は表示されない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).not.toHaveTextContent('天井')
    })

    it('Switch ON で天井回数 0 を入力するとエラー文言 + aria-invalid + disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      const input = screen.getByLabelText('天井回数')
      await user.clear(input)
      await user.type(input, '0')
      await user.tab()
      expect(await screen.findByText('試行回数は1以上を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('Switch ON ですり抜け率 -1 を入力するとエラー文言「0以上100以下」+ disabled', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      const input = screen.getByLabelText('天井すり抜け率')
      await user.clear(input)
      await user.type(input, '-1')
      await user.tab()
      expect(await screen.findByText('0以上100以下の数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
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

    it('Switch OFF にすると pityCount のエラーがあっても disabled にならない', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      const sw = screen.getByRole('switch', { name: '天井を考慮する' })
      await user.click(sw)
      const pity = screen.getByLabelText('天井回数')
      await user.clear(pity)
      await user.type(pity, '0')
      await user.tab()
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()

      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('button', { name: '計算' })).not.toBeDisabled()
    })

    it('Switch ON + 目標成功回数 3 で計算しても結果領域に「3個獲得」補助文言は表示されない（天井計算は1個前提）', async () => {
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
      expect(status).not.toHaveTextContent('個獲得')
    })

    it('Switch ON 時に目標成功回数エラーがあっても計算ボタンは disabled にならない（targetCount は無視されるため）', async () => {
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      const target = screen.getByLabelText('目標成功回数')
      await user.clear(target)
      await user.type(target, '0')
      await user.tab()
      // Switch ON 中は targetCount エラーが disabled に反映されない
      expect(screen.getByRole('button', { name: '計算' })).not.toBeDisabled()
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
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()

      await user.click(sw)
      expect(sw).toHaveAttribute('aria-checked', 'false')
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      // 通常計算(成功率50, 信頼度90, 目標成功回数1) → 4回
      expect(status).toHaveTextContent('4回')
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
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockImplementationOnce(
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
          (call: unknown[]) => isErrorBoundaryLogForErrorName(call, 'TypeError'),
        ),
      ).toBe(true)
    })

    it('天井ありの計算で想定外エラーが発生したときフォールバック UI に切り替わる', async () => {
      vi.mocked(tryCalculateTrialCountWithPity).mockImplementationOnce(() => {
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
          (call: unknown[]) => isErrorBoundaryLogForErrorName(call, 'TypeError'),
        ),
      ).toBe(true)
    })

    it('ドメインエラーはフォールバックではなくフォーム内 Alert で表示される', async () => {
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockReturnValueOnce({
        ok: false,
        message: 'ドメインエラー（テスト用）',
      })
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
      vi.mocked(tryCalculateTrialCountWithPity).mockReturnValueOnce({
        ok: false,
        message: '天井ドメインエラー（テスト用）',
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
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockImplementationOnce(
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
      expect(await screen.findByLabelText('成功率')).toHaveValue(null)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('4回')
    })
  })

  describe('入力変更時の calculationError クリア', () => {
    it('成功率を変更すると Alert が消える', async () => {
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
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
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
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
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '75%' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('天井 Switch 切替で Alert が消える', async () => {
      vi.mocked(tryCalculateTrialCountWithPity).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
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
      vi.mocked(tryCalculateTrialCountForMultipleSuccess).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
      const user = userEvent.setup()
      render(<ForwardForm />)
      await user.type(screen.getByLabelText('成功率'), '50')
      await user.click(screen.getByRole('button', { name: '計算' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('switch', { name: '天井を考慮する' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('天井 ON 時に天井回数を変更すると Alert が消える', async () => {
      vi.mocked(tryCalculateTrialCountWithPity).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
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
      vi.mocked(tryCalculateTrialCountWithPity).mockReturnValueOnce({
        ok: false,
        message: 'テストエラー',
      })
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
      // 結果領域(role=status) の直後の兄弟要素として probability-chart が存在
      const adjacent = container.querySelector(
        '[role="status"] + [data-testid="probability-chart"]',
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
