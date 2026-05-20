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

afterEach(() => {
  cleanup()
})
