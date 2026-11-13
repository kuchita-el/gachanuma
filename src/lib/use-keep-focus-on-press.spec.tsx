import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useKeepFocusOnPress } from './use-keep-focus-on-press'

function Harness({ onClick }: { onClick?: () => void }) {
  const pressProps = useKeepFocusOnPress(onClick)
  return (
    <>
      <input aria-label="入力" />
      <button type="button" {...pressProps}>押す</button>
    </>
  )
}

function setup(onClick?: () => void) {
  render(<Harness onClick={onClick} />)
  const input = screen.getByLabelText('入力')
  input.focus()
  return { input, button: screen.getByRole('button', { name: '押す' }) }
}

describe('useKeepFocusOnPress', () => {
  it('マウスの押し下げでは既定動作（フォーカス移動）を止め、クリック後も入力欄のフォーカスを保つ', () => {
    const { input, button } = setup()
    fireEvent.pointerDown(button, { pointerType: 'mouse' })
    // fireEvent は preventDefault されたとき false を返す
    expect(fireEvent.mouseDown(button)).toBe(false)
    fireEvent.click(button)
    expect(input).toHaveFocus()
  })

  it('タッチで押すと、クリックの時点で入力欄のフォーカスを外す（画面のキーボードを閉じる）', () => {
    const { input, button } = setup()
    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent.mouseDown(button)
    expect(input).toHaveFocus()
    fireEvent.click(button)
    expect(input).not.toHaveFocus()
  })

  it('ペンで押した場合もタッチと同じく入力欄のフォーカスを外す', () => {
    const { input, button } = setup()
    fireEvent.pointerDown(button, { pointerType: 'pen' })
    fireEvent.click(button)
    expect(input).not.toHaveFocus()
  })

  it('キーボードで押した場合（pointerdown なしの click）はフォーカスを変えない', () => {
    const { input, button } = setup()
    // 直前のタッチの記録が残っていても、次のキーボード操作には持ち越さない
    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent.click(button)
    input.focus()
    fireEvent.click(button)
    expect(input).toHaveFocus()
  })

  it('タッチが取り消された（pointercancel）あとのクリックでは、フォーカスを変えない', () => {
    const { input, button } = setup()
    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent.pointerCancel(button)
    fireEvent.click(button)
    expect(input).toHaveFocus()
  })

  it('click がキーボード由来（pointerType が空文字）なら、タッチの記録が残っていてもフォーカスを変えない', () => {
    const { input, button } = setup()
    // 指をボタンの外へずらして離した等で、click が来ないままタッチの記録が残った状態
    fireEvent.pointerDown(button, { pointerType: 'touch' })
    // 入力欄の Enter による送信で、ブラウザが送信ボタンに送る click
    fireEvent(button, new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: '' }))
    expect(input).toHaveFocus()
  })

  it('click 自体が pointerType: touch を持つ場合は、pointerdown の記録がなくてもフォーカスを外す', () => {
    const { input, button } = setup()
    fireEvent(button, new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }))
    expect(input).not.toHaveFocus()
  })

  it('pointerdown がタッチなら、click 側の pointerType が touch 以外（mouse など）でもフォーカスを外す', () => {
    const { input, button } = setup()
    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent(button, new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'mouse' }))
    expect(input).not.toHaveFocus()
  })

  it('クリックすると onClick が呼ばれる', () => {
    const onClick = vi.fn()
    const { button } = setup(onClick)
    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
