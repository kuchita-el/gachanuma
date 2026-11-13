import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { keepFocusOnMouseDown } from './keep-focus-on-mouse-down'

describe('keepFocusOnMouseDown', () => {
  it('mousedown の既定動作（フォーカス移動）を止める', () => {
    render(<button type="button" onMouseDown={keepFocusOnMouseDown}>押す</button>)
    // fireEvent は preventDefault されたとき false を返す
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: '押す' }))).toBe(false)
  })
})
