import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import Home from './page'

describe('Home', () => {
  it('成功率ラベルと入力欄が表示される', () => {
    render(<Home />)
    expect(screen.getByLabelText('成功率')).toBeInTheDocument()
  })

  it('成功率 50 を入力して計算ボタンを押すと 4回 が結果領域に表示される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('4回')
    expect(status).toHaveTextContent('90%の確率で成功するために必要な試行回数')
  })

  it('成功率 10 を入力して計算ボタンを押すと 22回 が表示される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByLabelText('成功率'), '10')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('22回')
  })

  it('成功率 1 を入力して計算ボタンを押すと 230回 が表示される（percentToRatio 結線の検証）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByLabelText('成功率'), '1')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('230回')
  })

  it('成功率 99 を入力して計算ボタンを押すと 1回 が表示される（高成功率境界）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByLabelText('成功率'), '99')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('1回')
  })

  it('成功率 0 を入力してフォーカスアウトすると境界値エラーが表示される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '0')
    await user.tab()
    expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('成功率 100 を入力してフォーカスアウトすると境界値エラーが表示される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '100')
    await user.tab()
    expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('結果領域に role="status" / aria-live="polite" が付与される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('Input に inputmode=decimal / type=number / step=any / aria-describedby が付与される', () => {
    render(<Home />)
    const input = screen.getByLabelText('成功率')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('step', 'any')
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('aria-describedby がヘルパーテキスト要素の id と連結される', () => {
    render(<Home />)
    const input = screen.getByLabelText('成功率')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    const helper = document.getElementById(describedBy!)
    expect(helper).not.toBeNull()
    expect(helper).toHaveTextContent('0より大きく100未満の数値を入力してください')
  })

  describe('信頼度UI', () => {
    it('信頼度ラベルと入力欄が表示され、初期値は 90 である', () => {
      render(<Home />)
      const input = screen.getByLabelText('信頼度') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('90')
    })

    it('プリセット 5 個（50/75/90/95/99）が描画される', () => {
      render(<Home />)
      for (const preset of [50, 75, 90, 95, 99]) {
        expect(screen.getByRole('button', { name: `${preset}%` })).toBeInTheDocument()
      }
    })

    it('初期表示時、プリセット 90 が aria-pressed=true で選択状態', () => {
      render(<Home />)
      expect(screen.getByRole('button', { name: '90%' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '50%' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('プリセット 75 をクリックすると信頼度フィールドが 75 に更新される（片方向同期）', async () => {
      const user = userEvent.setup()
      render(<Home />)
      await user.click(screen.getByRole('button', { name: '75%' }))
      const input = screen.getByLabelText('信頼度') as HTMLInputElement
      expect(input.value).toBe('75')
      expect(screen.getByRole('button', { name: '75%' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '90%' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('成功率 10 + 信頼度 50 で計算すると 7回 と 50%文言が表示される', async () => {
      const user = userEvent.setup()
      render(<Home />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '50%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('7回')
      expect(status).toHaveTextContent('50%の確率で成功するために必要な試行回数')
    })

    it('成功率 10 + 信頼度 99 で計算すると 44回 と 99%文言が表示される', async () => {
      const user = userEvent.setup()
      render(<Home />)
      await user.type(screen.getByLabelText('成功率'), '10')
      await user.click(screen.getByRole('button', { name: '99%' }))
      await user.click(screen.getByRole('button', { name: '計算' }))
      const status = await screen.findByRole('status', { name: '計算結果' })
      expect(status).toHaveTextContent('44回')
      expect(status).toHaveTextContent('99%の確率で成功するために必要な試行回数')
    })

    it('信頼度 0 でフォーカスアウトするとエラー文言と aria-invalid と計算ボタン disabled', async () => {
      const user = userEvent.setup()
      render(<Home />)
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
      render(<Home />)
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
      render(<Home />)
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
      render(<Home />)
      const input = screen.getByLabelText('信頼度')
      await user.clear(input)
      await user.tab()
      expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: '計算' })).toBeDisabled()
    })

    it('成功率 0/100 では計算ボタン disabled にはならず（信頼度起因のみ）、submit→aria-invalid の既存フローが維持される', async () => {
      const user = userEvent.setup()
      render(<Home />)
      const successRate = screen.getByLabelText('成功率')
      await user.type(successRate, '0')
      await user.tab()
      const submit = screen.getByRole('button', { name: '計算' })
      expect(submit).not.toBeDisabled()
      await user.click(submit)
      expect(successRate).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByRole('status', { name: '計算結果' })).not.toBeInTheDocument()
    })
  })
})
