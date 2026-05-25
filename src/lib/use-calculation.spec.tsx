import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Component, type ReactNode } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ok } from 'neverthrow'
import * as v from 'valibot'
import type { UseFormSubscribe } from 'react-hook-form'
import { useCalculation } from './use-calculation'
import { calculateTrialCount, type CalcResult } from '@/probability/calculator'
import { calculateTrialCountForMultipleSuccess } from '@/probability/negative-binomial'
import { domainErr } from '@/probability/domain-error'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTargetCountSchema,
} from '@/probability/probability'
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

// narrowing を通すため、各テストは「段1: status を先に固定（型ガード false 時の
// expect スキップ＝偽陽性を封じる）→ 段2: 型ガード内でフィールド観測」の 2 段でアサートする。
describe('useCalculation', () => {
  // UC-1: 初期状態は status='idle'（idle メンバには result/error が型上存在しないため status のみ観測）
  it('subscribe を受け取り、初期状態は status=idle・run は関数', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    expect(result.current.status).toBe('idle')
    expect(typeof result.current.run).toBe('function')
  })

  // UC-2: 計算成功で status='success' かつ result に値が入る
  it('計算成功時に status=success かつ result に値をセットする', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(42)))
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.result).toBe(42)
    }
  })

  // UC-3: ドメインエラーで status='error' かつ error に formatDomainError 文言
  it('ドメインエラー時に status=error かつ error に formatDomainError 文言をセットする', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() =>
      result.current.run(() =>
        domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
      ),
    )
    expect(result.current.status).toBe('error')
    if (result.current.status === 'error') {
      expect(result.current.error).toBe(
        '成功率が極端に小さいため試行回数を計算できません。値を見直してください。',
      )
    }
  })

  // UC-4: success→error→success の相互排他遷移。各段で status を固定しブランチ内で
  // フィールドを観測する。result/error の排他は型（type-test）が担保し、ここでは status
  // 値の遷移とブランチ内フィールドを観測する。
  it('成功→失敗→成功の遷移で status と result/error が排他的に更新される', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(10)))
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.result).toBe(10)
    }

    act(() =>
      result.current.run(() =>
        domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
      ),
    )
    expect(result.current.status).toBe('error')
    if (result.current.status === 'error') {
      expect(result.current.error).toBeDefined()
    }

    act(() => result.current.run(() => ok(20)))
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.result).toBe(20)
    }
  })

  // UC-5: error 状態でフォーム値変更（subscribe callback 発火）→ idle へ遷移
  it('ドメインエラー後に subscribe callback が発火すると idle へ遷移する', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() =>
      result.current.run(() =>
        domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
      ),
    )
    expect(result.current.status).toBe('error')
    act(() => harness.fireCallback())
    expect(result.current.status).toBe('idle')
  })

  // UC-6: success 状態でフォーム値変更 → success 保持（result も保持）
  it('成功後に subscribe callback が発火しても status=success と result が保持される', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    act(() => result.current.run(() => ok(99)))
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.result).toBe(99)
    }
    act(() => harness.fireCallback())
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.result).toBe(99)
    }
  })

  // UC-7: idle 状態でフォーム値変更 → idle 維持（no-op）
  it('idle 状態で subscribe callback が発火しても idle を維持する', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    expect(result.current.status).toBe('idle')
    act(() => harness.fireCallback())
    expect(result.current.status).toBe('idle')
  })

  // UC-11: run は判別に関与せず、どの status でも常時アクセス可能（spread 構造の回帰）
  it('run は status に依らず常時アクセス可能', () => {
    const harness = createSubscribeHarness()
    const { result } = renderHook(() =>
      useCalculation<number>(harness.subscribe),
    )
    expect(typeof result.current.run).toBe('function')
    act(() => result.current.run(() => ok(1)))
    expect(typeof result.current.run).toBe('function')
  })

  describe('想定外例外の Error Boundary 伝播（UC-8 / S-1）', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    // フックを使い、ボタンクリックでサンクを run に渡す最小コンポーネント。union を保持し
    // status 判別で result/error を DOM 出力する（分割代入で判別子を切り離さない）。伝播時に
    // status が未遷移＝success/error の DOM が描画されないことを検証可能にする。
    function Harness({ thunk }: { thunk: () => CalcResult<number> }) {
      const harness = createSubscribeHarness()
      const calc = useCalculation<number>(harness.subscribe)
      return (
        <div>
          <Button type="button" onClick={() => calc.run(thunk)}>
            run
          </Button>
          {calc.status === 'success' && <p data-testid="result">{calc.result}</p>}
          {calc.status === 'error' && <p data-testid="error">{calc.error}</p>}
        </div>
      )
    }

    it('サンクが DomainError 以外を throw した場合に Error Boundary へ伝播し、status は未遷移（result/error 未描画）', async () => {
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
      // status が success/error へ遷移していれば result/error が描画されているはず。Boundary
      // 捕捉により未描画＝status 未遷移（idle のまま）であることを確認する。
      expect(screen.queryByTestId('result')).not.toBeInTheDocument()
      expect(screen.queryByTestId('error')).not.toBeInTheDocument()
    })
  })

  // UC-9 / UC-10: 実関数を渡して NonFiniteResult / IterationLimitExceeded を実発火させ、
  // formatDomainError 経由の実文言が error に届くまでの結線を検証する。
  describe('実関数による結線テスト（UC-9 / UC-10）', () => {
    it('極小成功率で calculateTrialCount が NonFiniteResult を実発火し、status=error・実文言が現れる', () => {
      const harness = createSubscribeHarness()
      const { result } = renderHook(() =>
        useCalculation<number>(harness.subscribe),
      )
      act(() =>
        result.current.run(() =>
          calculateTrialCount(
            v.parse(validProbabilityRatioSchema, 1e-17),
            v.parse(validConfidenceSchema, 0.9),
          ),
        ),
      )
      expect(result.current.status).toBe('error')
      if (result.current.status === 'error') {
        expect(result.current.error).toBe(
          '成功率が極端に小さいため試行回数を計算できません。値を見直してください。',
        )
      }
    })

    it('極小成功率・目標2で calculateTrialCountForMultipleSuccess が IterationLimitExceeded を実発火し、status=error・実文言が現れる', () => {
      const harness = createSubscribeHarness()
      const { result } = renderHook(() =>
        useCalculation<number>(harness.subscribe),
      )
      act(() =>
        result.current.run(() =>
          calculateTrialCountForMultipleSuccess(
            v.parse(validProbabilityRatioSchema, 1e-17),
            v.parse(validTargetCountSchema, 2),
            v.parse(validConfidenceSchema, 0.9),
          ),
        ),
      )
      expect(result.current.status).toBe('error')
      if (result.current.status === 'error') {
        expect(result.current.error).toBe(
          '反復上限を超えても累積確率が信頼度に達しませんでした。値を見直してください。',
        )
      }
    })
  })
})
