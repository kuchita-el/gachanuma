import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom には ResizeObserver の実装がないため、Radix UI コンポーネント
// （Switch, Tabs 等）が要求する API をクラスとしてモックする（new で呼ばれるため）。
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserverMock {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as unknown as typeof ResizeObserver
}

// jsdom には Element.prototype.scrollIntoView の実装がないため、何もしない関数を補う。
// 計算後に結果へスクロールする処理（Issue #19）の呼び出しを検証するテストは vi.spyOn で監視する。
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}

afterEach(() => {
  cleanup()
})
