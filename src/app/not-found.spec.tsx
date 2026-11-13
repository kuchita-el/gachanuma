import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound, { metadata } from './not-found'

describe('app/not-found.tsx', () => {
  it('見出しとして「ページが見つかりません」が表示される', () => {
    render(<NotFound />)
    expect(
      screen.getByRole('heading', { name: 'ページが見つかりません' }),
    ).toBeInTheDocument()
  })

  it('ページが存在しない旨の案内文が表示される', () => {
    render(<NotFound />)
    expect(
      screen.getByText(/お探しのページは存在しないか、移動した可能性があります/),
    ).toBeInTheDocument()
  })

  it('トップページへ戻るリンクが描画され、href が "/" である', () => {
    render(<NotFound />)
    const link = screen.getByRole('link', { name: 'トップページへ戻る' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('metadata.title が「ページが見つかりません | 確率の泥沼」である', () => {
    expect(metadata.title).toBe('ページが見つかりません | 確率の泥沼')
  })
})
