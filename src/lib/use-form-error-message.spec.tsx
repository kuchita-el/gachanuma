import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { UseFormSubscribe } from 'react-hook-form'
import { useFormValueChange } from './use-form-error-message'

type SubscribeFn = UseFormSubscribe<Record<string, unknown>>
type SubscribeOptions = Parameters<SubscribeFn>[0]

interface SubscribeHarness {
  subscribe: SubscribeFn
  unsubscribe: ReturnType<typeof vi.fn>
  fireCallback: () => void
  lastOptions: () => SubscribeOptions
  callCount: () => number
}

function createSubscribeHarness(): SubscribeHarness {
  const unsubscribe = vi.fn()
  let lastOptions: SubscribeOptions | undefined
  let callCount = 0
  const subscribe = vi.fn((options: SubscribeOptions) => {
    lastOptions = options
    callCount += 1
    return unsubscribe
  }) as unknown as SubscribeFn
  return {
    subscribe,
    unsubscribe,
    fireCallback: () => {
      if (!lastOptions?.callback) throw new Error('callback not registered')
      lastOptions.callback({ values: {} } as never)
    },
    lastOptions: () => {
      if (!lastOptions) throw new Error('subscribe not called yet')
      return lastOptions
    },
    callCount: () => callCount,
  }
}

describe('useFormValueChange', () => {
  // FE-1: マウント時に subscribe が values 購読契約 + callback で 1 回呼ばれる
  it('マウント時に subscribe が formState: { values: true } と callback で 1 回呼ばれる', () => {
    const harness = createSubscribeHarness()
    renderHook(() => useFormValueChange(harness.subscribe, vi.fn()))
    expect(harness.subscribe).toHaveBeenCalledTimes(1)
    const options = harness.lastOptions()
    expect(options.formState).toEqual({ values: true })
    expect(typeof options.callback).toBe('function')
  })

  // FE-2: フォーム値変更（subscribe callback 発火）で渡した onChange が発火する
  it('フォーム値変更時に渡した onChange コールバックが発火する', () => {
    const harness = createSubscribeHarness()
    const onChange = vi.fn()
    renderHook(() => useFormValueChange(harness.subscribe, onChange))
    expect(onChange).not.toHaveBeenCalled()
    harness.fireCallback()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // FE-3: フォーム値変更が複数回起きると onChange も複数回発火する（無条件発火の汎用性）
  it('フォーム値変更が複数回起きると onChange も複数回発火する', () => {
    const harness = createSubscribeHarness()
    const onChange = vi.fn()
    renderHook(() => useFormValueChange(harness.subscribe, onChange))
    harness.fireCallback()
    harness.fireCallback()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  // FE-4: unmount 時に subscribe が返した unsubscribe 関数が呼ばれる（cleanup 契約）
  it('unmount 時に subscribe が返した unsubscribe 関数が呼ばれる', () => {
    const harness = createSubscribeHarness()
    const { unmount } = renderHook(() =>
      useFormValueChange(harness.subscribe, vi.fn()),
    )
    expect(harness.unsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1)
  })

  // FE-6: subscribe / onChange が安定参照なら再レンダで再購読しない
  it('安定参照のまま再レンダしても再購読しない', () => {
    const harness = createSubscribeHarness()
    const onChange = vi.fn()
    const { rerender } = renderHook(() =>
      useFormValueChange(harness.subscribe, onChange),
    )
    expect(harness.callCount()).toBe(1)
    rerender()
    expect(harness.callCount()).toBe(1)
  })
})
