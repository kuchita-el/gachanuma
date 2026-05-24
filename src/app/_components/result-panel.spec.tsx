import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResultPanel } from '@/app/_components/result-panel'

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
