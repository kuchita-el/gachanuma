import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ResultPanel, STALE_RESULT_NOTICE } from '@/app/_components/result-panel'

describe('ResultPanel', () => {
  it('role="status" / aria-live="polite" / aria-label="計算結果" の三属性が同時付与される', () => {
    render(
      <ResultPanel>
        <p>本文</p>
      </ResultPanel>,
    )
    const root = screen.getByRole('status', { name: '計算結果' })
    expect(root).toHaveAttribute('aria-live', 'polite')
    expect(root).toHaveAttribute('aria-label', '計算結果')
  })

  it('ルート要素が bg-primary/10 / rounded-lg / p-6 クラスを持つ', () => {
    const { container } = render(
      <ResultPanel>
        <p>本文</p>
      </ResultPanel>,
    )
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('bg-primary/10', 'rounded-lg', 'p-6')
  })

  it('既定では mt-8 を含まない（呼び出し側責務）', () => {
    const { container } = render(
      <ResultPanel>
        <p>本文</p>
      </ResultPanel>,
    )
    const root = container.firstChild as HTMLElement
    expect(root).not.toHaveClass('mt-8')
  })

  it('固定見出し「計算結果」が h2 として描画される', () => {
    render(
      <ResultPanel>
        <p>本文</p>
      </ResultPanel>,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: '計算結果' }),
    ).toBeInTheDocument()
  })

  it('children が DOM 内に描画される', () => {
    render(
      <ResultPanel>
        <p data-testid="child">本文テスト</p>
      </ResultPanel>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('本文テスト')).toBeInTheDocument()
  })

  it('className を渡すと既定クラスとマージされる', () => {
    const { container } = render(
      <ResultPanel className="mt-8 my-cls">
        <p>本文</p>
      </ResultPanel>,
    )
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass(
      'bg-primary/10',
      'rounded-lg',
      'p-6',
      'mt-8',
      'my-cls',
    )
  })

  it('ルート要素は div である', () => {
    const { container } = render(
      <ResultPanel>
        <p>本文</p>
      </ResultPanel>,
    )
    const root = container.firstChild as HTMLElement
    expect(root.tagName).toBe('DIV')
  })
})

describe('ResultPanel（古い結果の表示、Issue #9）', () => {
  it('既定（stale=false）では本文を薄くせず、注記と再計算ボタンを表示しない', () => {
    render(
      <ResultPanel onRecalculate={() => {}}>
        <p>本文</p>
      </ResultPanel>,
    )
    expect(screen.getByTestId('result-panel-body')).not.toHaveClass('opacity-50')
    expect(screen.queryByText(STALE_RESULT_NOTICE)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'この入力で再計算' })).not.toBeInTheDocument()
  })

  it('stale=true では本文を薄く表示し、注記と再計算ボタンを結果パネル内に表示する', () => {
    render(
      <ResultPanel stale onRecalculate={() => {}}>
        <p>本文</p>
      </ResultPanel>,
    )
    expect(screen.getByTestId('result-panel-body')).toHaveClass('opacity-50')
    const status = screen.getByRole('status', { name: '計算結果' })
    expect(status).toHaveTextContent(STALE_RESULT_NOTICE)
    const button = screen.getByRole('button', { name: 'この入力で再計算' })
    // 注記とボタンは薄表示の対象外
    expect(screen.getByTestId('result-panel-body')).not.toContainElement(button)
  })

  it('「この入力で再計算」を押すと onRecalculate が呼ばれる', async () => {
    const user = userEvent.setup()
    const onRecalculate = vi.fn()
    render(
      <ResultPanel stale onRecalculate={onRecalculate}>
        <p>本文</p>
      </ResultPanel>,
    )
    await user.click(screen.getByRole('button', { name: 'この入力で再計算' }))
    expect(onRecalculate).toHaveBeenCalledTimes(1)
  })
})
