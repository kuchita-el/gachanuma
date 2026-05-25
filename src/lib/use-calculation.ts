'use client'

import { useState } from 'react'
import type { FieldValues, UseFormSubscribe } from 'react-hook-form'
import type { CalcResult } from '@/probability/calculator'
import { formatDomainError } from '@/probability/domain-error'
import { useFormErrorMessage } from './use-form-error-message'
import { useThrowToErrorBoundary } from './use-throw-to-error-boundary'

/**
 * 計算実行〜結果/エラーのライフサイクルを集約するフック。
 *
 * `forward-form` / `inverse-form` の `onSubmit` 内で対称的に重複していた
 * 「計算 Result の成功/失敗分岐 → result/error の排他 setter → 想定外例外の
 * Error Boundary パススルー」を 1 箇所に集約する。エラー state は
 * `useFormErrorMessage(subscribe)` を内包して所有し（Pattern A: nested composition）、
 * フォーム値変更時の自動クリアを引き継ぐ。
 *
 * `run` は計算実行サンク（`() => CalcResult<TResult>`）を毎回受け取る方式。
 * 計算関数の呼び出しは呼び出し側（form）に残るため、form 単体 spec の
 * モジュールモック（`vi.mock` + `vi.fn`）がそのまま機能する。`number → 表示用
 * オブジェクト` の整形が必要な場合はサンクの戻り Result を `.map` して渡す。
 *
 * `run` の try は計算呼び出し（サンク実行）の最小範囲のみを包む。React の state
 * setter（`setResult` / `setError`）は Hooks API の不変条件により同期 throw しない
 * ため、`match` のコールバック内 setter を try で囲う必要がない。これにより想定外
 * 例外の Boundary 委譲経路に setter を巻き込まない（Issue #91 / PR #93 レビュー S-1）。
 *
 * @example
 * const { subscribe } = useForm()
 * const { result, error, run } = useCalculation<DisplayResult>(subscribe)
 * run(() => calc(...).map(value => ({ ... })))
 */
export interface UseCalculationReturn<TResult> {
  result: TResult | undefined
  error: string | undefined
  run: (calc: () => CalcResult<TResult>) => void
}

export function useCalculation<
  TResult,
  TFieldValues extends FieldValues = FieldValues,
>(subscribe: UseFormSubscribe<TFieldValues>): UseCalculationReturn<TResult> {
  const [result, setResult] = useState<TResult>()
  const [error, setError] = useFormErrorMessage(subscribe)
  const throwToErrorBoundary = useThrowToErrorBoundary()

  const run = (calc: () => CalcResult<TResult>): void => {
    let calcResult: CalcResult<TResult>
    try {
      calcResult = calc()
    }
    catch (e) {
      throwToErrorBoundary(e)
      return
    }
    calcResult.match(
      (value) => {
        setResult(value)
        setError(undefined)
      },
      (domainError) => {
        setResult(undefined)
        setError(formatDomainError(domainError))
      },
    )
  }

  return { result, error, run }
}
