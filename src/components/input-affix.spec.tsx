import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InputAffix } from '@/components/input-affix'

describe('InputAffix', () => {
  it('suffix="%" を渡すと span に % が表示される', () => {
    render(
      <InputAffix suffix="%">
        <input data-testid="x" />
      </InputAffix>,
    )
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('suffix="回" を渡すと span に 回 が表示される', () => {
    render(
      <InputAffix suffix="回">
        <input data-testid="x" />
      </InputAffix>,
    )
    expect(screen.getByText('回')).toBeInTheDocument()
  })

  it('children の input が DOM に描画される', () => {
    render(
      <InputAffix suffix="%">
        <input data-testid="x" />
      </InputAffix>,
    )
    expect(screen.getByTestId('x')).toBeInTheDocument()
  })

  it('ラッパは relative・suffix は span 要素として描画される', () => {
    const { container } = render(
      <InputAffix suffix="%">
        <input data-testid="x" />
      </InputAffix>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.className).toMatch(/\brelative\b/)
    const suffixSpan = screen.getByText('%')
    expect(suffixSpan.tagName).toBe('SPAN')
  })

  it('className を渡すと relative と合成される', () => {
    const { container } = render(
      <InputAffix suffix="%" className="my-custom-cls">
        <input data-testid="x" />
      </InputAffix>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toMatch(/\brelative\b/)
    expect(wrapper.className).toMatch(/\bmy-custom-cls\b/)
  })
})
