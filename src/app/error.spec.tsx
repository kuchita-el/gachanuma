import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import ErrorPage from './error'

describe('app/error.tsx', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('role="alert" 要素にユーザー向け文言「予期しないエラーが発生しました」が含まれる', () => {
    render(<ErrorPage error={new Error('boom')} reset={vi.fn()} />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('予期しないエラーが発生しました')
  })

  it('フォールバック UI に再試行案内とリロード案内が含まれる', () => {
    render(<ErrorPage error={new Error('boom')} reset={vi.fn()} />)
    expect(screen.getByText(/再試行ボタンで再実行できます/)).toBeInTheDocument()
    expect(screen.getByText(/ページを再読み込みしてください/)).toBeInTheDocument()
  })

  it('再試行ボタンが描画され、押下で reset が 1 回呼ばれる', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    render(<ErrorPage error={new Error('boom')} reset={reset} />)
    const button = screen.getByRole('button', { name: '再試行' })
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('レンダ時に console.error が引数の Error オブジェクトを引数として 1 回以上呼ばれる', () => {
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith(error)
  })

  it('rerender で error が別インスタンスに差し替わると console.error が再度呼ばれる', () => {
    const error1 = new Error('boom1')
    const error2 = new Error('boom2')
    const { rerender } = render(<ErrorPage error={error1} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith(error1)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

    rerender(<ErrorPage error={error2} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith(error2)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })

  it('rerender で error が同一参照のままなら console.error は再度呼ばれない', () => {
    const error = new Error('boom')
    const { rerender } = render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

    rerender(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
  })
})
