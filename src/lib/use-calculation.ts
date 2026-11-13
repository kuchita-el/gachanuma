'use client'

import { useCallback, useState } from 'react'
import type { FieldValues, UseFormSubscribe } from 'react-hook-form'
import type { Result } from 'neverthrow'
import type { DomainError } from '@/probability/domain-error'
import { formatDomainError } from '@/lib/format-domain-error'
import { useFormValueChange } from './use-form-error-message'
import { useThrowToErrorBoundary } from './use-throw-to-error-boundary'

/**
 * 計算の状態。
 * - `idle`: 未計算。またはエラーの表示中に入力が変わった
 * - `success`: 計算に成功した。`stale` は、計算後に入力が変わり、表示中の結果が今の入力と一致しないこと（Issue #9）
 * - `error`: ドメインエラー（ユーザー向けの文言）
 *
 * `result` と `error` を同時に持つ状態や、どちらも持たない `success` / `error` は型の上で作れない（Issue #108）。
 */
export type CalculationState<TResult>
  = | { status: 'idle' }
    | { status: 'success', result: TResult, stale: boolean }
    | { status: 'error', error: string }

export type UseCalculationReturn<TResult> = CalculationState<TResult> & {
  run: (calc: () => Result<TResult, DomainError>) => void
  /** 計算を実行した回数（成功・ドメインエラーとも数え、入力の変更では増えない）。結果へのスクロールに使う（Issue #19） */
  runCount: number
}

/**
 * 計算の実行と、その結果・エラーの状態を管理するフック。
 *
 * - ドメイン上の失敗（Result の err）はエラーの状態にし、想定外の例外は Error Boundary に渡す
 * - 入力が変わったら、エラーは消し（`idle`）、結果は残したまま `stale` にする（Issue #9）
 *
 * 戻り値を分割代入しないこと。`status` を切り離すと、`result` / `error` の型の絞り込みが効かなくなる。
 *
 * `run` が計算関数ではなく、計算を呼び出すサンクを受け取るのは、計算関数の呼び出しをフォーム側に残し、
 * フォームの spec でモジュールモック（`vi.mock`）を効かせるため。
 *
 * `run` を1つのイベント内で複数回呼ばないこと。内部の `useThrowToErrorBoundary` は、同じレンダー内で
 * 複数回呼ばれると先の例外を取りこぼす。
 *
 * @example
 * const { subscribe } = useForm()
 * const calc = useCalculation<DisplayResult>(subscribe)
 * calc.run(() => calculateXxx(...).map(value => ({ ... })))
 * if (calc.status === 'success') { ... calc.result ... }
 */
export function useCalculation<
  TResult,
  TFieldValues extends FieldValues = FieldValues,
>(subscribe: UseFormSubscribe<TFieldValues>): UseCalculationReturn<TResult> {
  const [state, setState] = useState<CalculationState<TResult>>({ status: 'idle' })
  const [runCount, setRunCount] = useState(0)
  const throwToErrorBoundary = useThrowToErrorBoundary()

  const handleFormValueChange = useCallback(() => {
    setState((prev) => {
      if (prev.status === 'error') return { status: 'idle' }
      if (prev.status === 'success' && !prev.stale) return { ...prev, stale: true }
      return prev
    })
  }, [])
  useFormValueChange(subscribe, handleFormValueChange)

  const run = (calc: () => Result<TResult, DomainError>): void => {
    let calcResult: Result<TResult, DomainError>
    // setState は throw しないため、try で囲むのは計算の呼び出しだけでよい（Issue #91）
    try {
      calcResult = calc()
    }
    catch (e) {
      throwToErrorBoundary(e)
      return
    }
    calcResult.match(
      (value) => {
        setState({ status: 'success', result: value, stale: false })
        setRunCount(count => count + 1)
      },
      (domainError) => {
        setState({ status: 'error', error: formatDomainError(domainError) })
        setRunCount(count => count + 1)
      },
    )
  }

  return { ...state, run, runCount }
}
