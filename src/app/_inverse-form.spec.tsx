import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { InverseForm } from './_inverse-form'

describe('InverseForm', () => {
  it('成功率ラベルと試行回数ラベルが描画される', () => {
    render(<InverseForm />)
    expect(screen.getByLabelText('成功率')).toBeInTheDocument()
    expect(screen.getByLabelText('試行回数')).toBeInTheDocument()
  })

  it('成功率 50 + 試行回数 4 で計算すると「93.75%」と「4回試行したとき少なくとも1回成功する確率」が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.type(screen.getByLabelText('試行回数'), '4')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('93.75%')
    expect(status).toHaveTextContent('4回試行したとき少なくとも1回成功する確率')
  })

  it('成功率 10 + 試行回数 22 で計算すると 90% 以上の値（90.15%）が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '10')
    await user.type(screen.getByLabelText('試行回数'), '22')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('90.15%')
  })

  it('成功率 50 + 試行回数 1 で計算すると「50.00%」が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.type(screen.getByLabelText('試行回数'), '1')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('50.00%')
  })

  it('成功率 99 + 試行回数 1 で計算すると「99.00%」が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '99')
    await user.type(screen.getByLabelText('試行回数'), '1')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('99.00%')
  })

  it('成功率 1 + 試行回数 1 で計算すると「1.00%」が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '1')
    await user.type(screen.getByLabelText('試行回数'), '1')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent('1.00%')
  })

  it('成功率 0 でフォーカスアウトすると aria-invalid とエラー文言が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '0')
    await user.tab()
    expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('成功率 100 でフォーカスアウトするとエラー文言が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '100')
    await user.tab()
    expect(await screen.findByText('0より大きく100未満の数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('試行回数 0 でフォーカスアウトするとエラー文言「試行回数は1以上を指定してください。」', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    const input = screen.getByLabelText('試行回数')
    await user.type(input, '0')
    await user.tab()
    expect(await screen.findByText('試行回数は1以上を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('試行回数 -1 でフォーカスアウトするとエラー文言が表示される', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    const input = screen.getByLabelText('試行回数')
    await user.type(input, '-1')
    await user.tab()
    expect(await screen.findByText('試行回数は1以上を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('試行回数 1.5（非整数）でエラー文言「試行回数は整数を指定してください。」', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    const input = screen.getByLabelText('試行回数')
    await user.type(input, '1.5')
    await user.tab()
    expect(await screen.findByText('試行回数は整数を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('試行回数空欄でフォーカスアウトするとエラー文言「数値を指定してください。」', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    const input = screen.getByLabelText('試行回数')
    await user.click(input)
    await user.tab()
    expect(await screen.findByText('数値を指定してください。')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('成功率エラー時に submit を押しても結果は表示されない', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '0')
    await user.type(screen.getByLabelText('試行回数'), '4')
    await user.click(screen.getByRole('button', { name: '計算' }))
    expect(screen.queryByRole('status', { name: '計算結果' })).not.toBeInTheDocument()
  })

  it('結果領域に role="status" / aria-live="polite" / aria-label="計算結果"', async () => {
    const user = userEvent.setup()
    render(<InverseForm />)
    await user.type(screen.getByLabelText('成功率'), '50')
    await user.type(screen.getByLabelText('試行回数'), '4')
    await user.click(screen.getByRole('button', { name: '計算' }))
    const status = await screen.findByRole('status', { name: '計算結果' })
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('成功率 Input に inputmode=decimal / type=number / step=any / aria-describedby が付与される', () => {
    render(<InverseForm />)
    const input = screen.getByLabelText('成功率')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('step', 'any')
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('試行回数 Input に inputmode=numeric / type=number / aria-describedby が付与される', () => {
    render(<InverseForm />)
    const input = screen.getByLabelText('試行回数')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('aria-describedby がヘルパーテキスト要素の id と連結される（成功率）', () => {
    render(<InverseForm />)
    const input = screen.getByLabelText('成功率')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    const helper = document.getElementById(describedBy!)
    expect(helper).toHaveTextContent('0より大きく100未満の数値を入力してください')
  })

  it('aria-describedby がヘルパーテキスト要素の id と連結される（試行回数）', () => {
    render(<InverseForm />)
    const input = screen.getByLabelText('試行回数')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    const helper = document.getElementById(describedBy!)
    expect(helper).toHaveTextContent('1以上の整数を入力してください')
  })
})
