import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Component, type ReactNode } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ok } from 'neverthrow'
import type { UseFormSubscribe } from 'react-hook-form'
import { useCalculation } from './use-calculation'
import { calculateTrialCount, type CalcResult } from '@/probability/calculator'
import { calculateTrialCountForMultipleSuccess } from '@/probability/negative-binomial'
import { domainErr } from '@/probability/domain-error'
import { Button } from '@/components/ui/button'

type SubscribeFn = UseFormSubscribe<Record<string, unknown>>
type SubscribeOptions = Parameters<SubscribeFn>[0]

interface SubscribeHarness {
  subscribe: SubscribeFn
  fireCallback: () => void
}

// use-form-error-message.spec.tsx の createSubscribeHarness を踏襲。subscribe を
// モック化し、登録された callback を手動発火してフォーム値変更をシミュレートする。
function createSubscribeHarness(): SubscribeHarness {
  let lastOptions: SubscribeOptions | undefined
  const subscribe = vi.fn((options: SubscribeOptions) => {
    lastOptions = options
    return vi.fn()
  }) as unknown as SubscribeFn
  return {
    subscribe,
    fireCallback: () => {
      if (!lastOptions?.callback) throw new Error('callback not registered')
      lastOptions.callback({ values: {} } as never)
    },
  }
}

// use-throw-to-error-boundary.spec.tsx の CapturingBoundary を流用。
class CapturingBoundary extends Component<
  { onCatch: (e: Error) => void, children: ReactNode },
  { caught: boolean }
> {
  state = { caught: false }
  static getDerivedStateFromError(): { caught: boolean } {
    return { caught: true }
  }

  componentDidCatch(error: Error): void {
    this.props.onCatch(error)
  }

  render(): ReactNode {
    if (this.state.caught) return <div data-testid="caught" />
    return this.props.children
  }
}

describe('useCalculation', () => {
  // AC1: 戻り値の形状とジェネリクス result 型
  it('subscribe を受け取り { result, error, run } を返し、初期状態は result/error ともに undefined', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    expect(result.current.result).toBeUndefined()
    expect(result.current.error).toBeUndefined()
    expect(typeof result.current.run).toBe('function')
  })

  // AC2: 計算成功 → result セット & error クリア
  it('計算成功時に result をセットし error をクリアする', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(42)))
    expect(result.current.result).toBe(42)
    expect(result.current.error).toBeUndefined()
  })

  // AC2: ドメインエラー → result クリア & error に formatDomainError 文言
  it('ドメインエラー時に result をクリアし error に formatDomainError 文言をセットする', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(42)))
    act(() =>
      result.current.run(() =>
        domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
      ),
    )
    expect(result.current.result).toBeUndefined()
    expect(result.current.error).toBe(
      '成功率が極端に小さいため試行回数を計算できません。値を見直してください。',
    )
  })

  // AC2: 成功→失敗→成功の相互遷移で result/error が排他的に更新される
  it('成功→失敗→成功の遷移で result と error が排他的に更新される', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(10)))
    expect(result.current.result).toBe(10)
    expect(result.current.error).toBeUndefined()

    act(() =>
      result.current.run(() =>
        domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
      ),
    )
    expect(result.current.result).toBeUndefined()
    expect(result.current.error).toBeDefined()

    act(() => result.current.run(() => ok(20)))
    expect(result.current.result).toBe(20)
    expect(result.current.error).toBeUndefined()
  })

  // 内包する useFormErrorMessage の挙動を 2 関心に分離して検証する。result と error は
  // 排他更新のため「両方セット済み」状態は作れない（result 保持と error クリアは別 run 起点）。
  it('成功後に subscribe callback が発火しても result は保持される', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(99)))
    expect(result.current.result).toBe(99)
    act(() => harness.fireCallback())
    expect(result.current.result).toBe(99)
  })

  it('ドメインエラー後に subscribe callback が発火すると error がクリアされる', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() =>
      result.current.run(() =>
        domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
      ),
    )
    expect(result.current.error).toBeDefined()
    act(() => harness.fireCallback())
    expect(result.current.error).toBeUndefined()
  })

  describe('想定外例外の Error Boundary 伝播（AC3 / S-1）', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    // フックを使い、ボタンクリックでサンクを run に渡す最小コンポーネント。
    // result/error を DOM に出力し、伝播時に未更新であることを検証可能にする。
    function Harness({ thunk }: { thunk: () => CalcResult<number> }) {
      const harness = createSubscribeHarness()
      const { result, error, run } = useCalculation<number>(harness.subscribe)
      return (
        <div>
          <Button type="button" onClick={() => run(thunk)}>
            run
          </Button>
          {result !== undefined && <p data-testid="result">{result}</p>}
          {error !== undefined && <p data-testid="error">{error}</p>}
        </div>
      )
    }

    it('サンクが DomainError 以外を throw した場合に Error Boundary へ伝播し、result/error は未更新', async () => {
      const user = userEvent.setup()
      const original = new TypeError('想定外')
      const captured: Error[] = []
      const thunk = (): CalcResult<number> => {
        throw original
      }
      render(
        <CapturingBoundary onCatch={e => captured.push(e)}>
          <Harness thunk={thunk} />
        </CapturingBoundary>,
      )
      await user.click(screen.getByRole('button', { name: 'run' }))
      expect(await screen.findByTestId('caught')).toBeInTheDocument()
      expect(captured[0]).toBe(original)
      // setter が呼ばれていれば result/error が描画されているはず。Boundary 捕捉により
      // それらは描画されず caught フォールバックに置き換わる。
      expect(screen.queryByTestId('result')).not.toBeInTheDocument()
      expect(screen.queryByTestId('error')).not.toBeInTheDocument()
    })
  })

  // AC5 / I-3: 実関数を渡して NonFiniteResult / IterationLimitExceeded を実発火させ、
  // formatDomainError 経由の実文言が error に届くまでの結線を検証する。
  describe('実関数による結線テスト（AC5 / I-3）', () => {
    it('極小成功率で calculateTrialCount が NonFiniteResult を実発火し、error に実文言が現れる', () => {
      const harness = createSubscribeHarness()
      const { result } = renderHook(() =>
        useCalculation<number>(harness.subscribe),
      )
      act(() => result.current.run(() => calculateTrialCount(1e-17, 0.9)))
      expect(result.current.result).toBeUndefined()
      expect(result.current.error).toBe(
        '成功率が極端に小さいため試行回数を計算できません。値を見直してください。',
      )
    })

    it('極小成功率・目標2で calculateTrialCountForMultipleSuccess が IterationLimitExceeded を実発火し、error に実文言が現れる', () => {
      const harness = createSubscribeHarness()
      const { result } = renderHook(() =>
        useCalculation<number>(harness.subscribe),
      )
      act(() =>
        result.current.run(() =>
          calculateTrialCountForMultipleSuccess(1e-17, 2, 0.9),
        ),
      )
      expect(result.current.result).toBeUndefined()
      expect(result.current.error).toBe(
        '反復上限を超えても累積確率が信頼度に達しませんでした。値を見直してください。',
      )
    })
  })
})
