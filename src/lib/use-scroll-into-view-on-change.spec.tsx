import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScrollIntoViewOnChange } from './use-scroll-into-view-on-change'

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
}

describe('useScrollIntoViewOnChange', () => {
  let element: HTMLDivElement
  let scrollIntoView: MockInstance<Element['scrollIntoView']>

  beforeEach(() => {
    element = document.createElement('div')
    // jsdom の scrollIntoView は vitest.setup.ts で補った no-op。呼び出しを監視する
    scrollIntoView = vi.spyOn(element, 'scrollIntoView')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('key が 0（未計算）のときはスクロールしない', () => {
    mockMatchMedia(false)
    renderHook(() => useScrollIntoViewOnChange({ current: element }, 0))
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('key が変わると block: nearest / behavior: smooth でスクロールする', () => {
    mockMatchMedia(false)
    const { rerender } = renderHook(
      ({ key }) => useScrollIntoViewOnChange({ current: element }, key),
      { initialProps: { key: 0 } },
    )
    rerender({ key: 1 })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
  })

  it('prefers-reduced-motion: reduce のときは behavior: auto でスクロールする', () => {
    mockMatchMedia(true)
    const { rerender } = renderHook(
      ({ key }) => useScrollIntoViewOnChange({ current: element }, key),
      { initialProps: { key: 0 } },
    )
    rerender({ key: 1 })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
  })

  it('key が同じまま再レンダリングされてもスクロールしない', () => {
    mockMatchMedia(false)
    const ref = { current: element }
    const { rerender } = renderHook(
      ({ key }) => useScrollIntoViewOnChange(ref, key),
      { initialProps: { key: 1 } },
    )
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    rerender({ key: 1 })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('ref が未接続（null）でも例外にならない', () => {
    mockMatchMedia(false)
    expect(() =>
      renderHook(() => useScrollIntoViewOnChange({ current: null }, 1)),
    ).not.toThrow()
  })
})
