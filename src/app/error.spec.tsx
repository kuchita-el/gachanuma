import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { usePathname } from 'next/navigation'
import ErrorPage from './error'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('app/error.tsx', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(usePathname).mockReturnValue('/test-path')
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.mocked(usePathname).mockReset()
  })

  it('エラータイトルとして「予期しないエラーが発生しました」が表示される', () => {
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

  it('レンダ時に console.error が "[error-boundary]" ラベルと { pathname, name, message, stack, digest, cause } 構造化オブジェクトの 2 引数で 1 回呼ばれる', () => {
    vi.mocked(usePathname).mockReturnValue('/forward')
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error-boundary]', {
      pathname: '/forward',
      name: 'Error',
      message: 'boom',
      stack: error.stack,
      digest: undefined,
      cause: undefined,
    })
  })

  it('rerender で error が別インスタンスに差し替わると構造化ログが新しい error の情報で再度呼ばれる', () => {
    vi.mocked(usePathname).mockReturnValue('/forward')
    const error1 = new Error('boom1')
    const error2 = new TypeError('boom2')
    const { rerender } = render(<ErrorPage error={error1} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[error-boundary]', {
      pathname: '/forward',
      name: 'Error',
      message: 'boom1',
      stack: error1.stack,
      digest: undefined,
      cause: undefined,
    })

    rerender(<ErrorPage error={error2} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[error-boundary]', {
      pathname: '/forward',
      name: 'TypeError',
      message: 'boom2',
      stack: error2.stack,
      digest: undefined,
      cause: undefined,
    })
  })

  it('rerender で error が同一参照のままなら console.error は再度呼ばれない', () => {
    const error = new Error('boom')
    const { rerender } = render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

    rerender(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
  })

  it('usePathname の戻り値が異なる経路では構造化ログの pathname フィールドがその値を反映する', () => {
    vi.mocked(usePathname).mockReturnValue('/inverse')
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error-boundary]', {
      pathname: '/inverse',
      name: 'Error',
      message: 'boom',
      stack: error.stack,
      digest: undefined,
      cause: undefined,
    })
  })

  it('error.stack が undefined のときも 6 プロパティ完全一致で構造化ログが呼ばれ、例外を投げない', () => {
    vi.mocked(usePathname).mockReturnValue('/test-path')
    const error = new Error('boom')
    Object.defineProperty(error, 'stack', { value: undefined, configurable: true })
    expect(() =>
      render(<ErrorPage error={error} reset={vi.fn()} />),
    ).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error-boundary]', {
      pathname: '/test-path',
      name: 'Error',
      message: 'boom',
      stack: undefined,
      digest: undefined,
      cause: undefined,
    })
  })

  it('error.digest が文字列のとき構造化ログの digest フィールドにその値が反映される', () => {
    vi.mocked(usePathname).mockReturnValue('/test-path')
    const error = Object.assign(new Error('boom'), { digest: 'abc123' })
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error-boundary]', {
      pathname: '/test-path',
      name: 'Error',
      message: 'boom',
      stack: error.stack,
      digest: 'abc123',
      cause: undefined,
    })
  })

  it('error.cause が非 Error 値（POJO）のとき構造化ログの cause フィールドにその参照が保持される', () => {
    vi.mocked(usePathname).mockReturnValue('/test-path')
    const original = { code: 42, payload: 'orig' }
    const error = new Error(String(original), { cause: original })
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error-boundary]', {
      pathname: '/test-path',
      name: 'Error',
      message: '[object Object]',
      stack: error.stack,
      digest: undefined,
      cause: original,
    })
  })

  it('error.cause が Error インスタンスのとき構造化ログの cause フィールドにその Error が保持される', () => {
    vi.mocked(usePathname).mockReturnValue('/test-path')
    const root = new TypeError('root cause')
    const error = new Error('wrapped', { cause: root })
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error-boundary]', {
      pathname: '/test-path',
      name: 'Error',
      message: 'wrapped',
      stack: error.stack,
      digest: undefined,
      cause: root,
    })
  })
})
