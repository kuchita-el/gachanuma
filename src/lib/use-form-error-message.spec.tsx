import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { UseFormSubscribe } from 'react-hook-form'
import { useFormErrorMessage } from './use-form-error-message'

type SubscribeOptions = Parameters<UseFormSubscribe<Record<string, unknown>>>[0]

interface SubscribeHarness {
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  fireCallback: () => void
  lastOptions: () => SubscribeOptions
}

function createSubscribeHarness(): SubscribeHarness {
  const unsubscribe = vi.fn()
  let lastOptions: SubscribeOptions | undefined
  const subscribe = vi.fn((options: SubscribeOptions) => {
    lastOptions = options
    return unsubscribe
  })
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
  }
}

describe('useFormErrorMessage', () => {
  it('初期値なしでマウントすると message は undefined を返す', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useFormErrorMessage(harness.subscribe as unknown as UseFormSubscribe<Record<string, unknown>>),
    )
    expect(result.current[0]).toBeUndefined()
    expect(typeof result.current[1]).toBe('function')
  })

  it('初期値ありでマウントすると message に初期値が反映される', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useFormErrorMessage(
        harness.subscribe as unknown as UseFormSubscribe<Record<string, unknown>>,
        '初期メッセージ',
      ),
    )
    expect(result.current[0]).toBe('初期メッセージ')
  })

  it('マウント時に subscribe が formState: { values: true } と callback で 1 回呼ばれる', () => {
    const harness = createSubscribeHarness()
    renderHook(() =>
      useFormErrorMessage(harness.subscribe as unknown as UseFormSubscribe<Record<string, unknown>>),
    )
    expect(harness.subscribe).toHaveBeenCalledTimes(1)
    const options = harness.lastOptions()
    expect(options.formState).toEqual({ values: true })
    expect(typeof options.callback).toBe('function')
  })

  it('setter で値をセットした後、subscribe callback 発火で undefined に遷移する', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useFormErrorMessage(
        harness.subscribe as unknown as UseFormSubscribe<Record<string, unknown>>,
        '初期',
      ),
    )
    act(() => result.current[1]('エラー'))
    expect(result.current[0]).toBe('エラー')
    act(() => harness.fireCallback())
    expect(result.current[0]).toBeUndefined()
  })

  it('setter で任意の文字列を渡すと message にセットされ、undefined を渡すとクリアされる', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useFormErrorMessage(harness.subscribe as unknown as UseFormSubscribe<Record<string, unknown>>),
    )
    act(() => result.current[1]('計算エラー'))
    expect(result.current[0]).toBe('計算エラー')
    act(() => result.current[1](undefined))
    expect(result.current[0]).toBeUndefined()
  })

  it('unmount 時に subscribe が返した unsubscribe 関数が呼ばれる', () => {
    const harness = createSubscribeHarness()
    const { unmount } = renderHook(() =>
      useFormErrorMessage(harness.subscribe as unknown as UseFormSubscribe<Record<string, unknown>>),
    )
    expect(harness.unsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
