'use client'

import { useCallback, useState } from 'react'
import type { FieldValues, UseFormSubscribe } from 'react-hook-form'
import type { Result } from 'neverthrow'
import type { DomainError } from '@/probability/domain-error'
import { formatDomainError } from '@/lib/format-domain-error'
import { useFormValueChange } from './use-form-error-message'
import { useThrowToErrorBoundary } from './use-throw-to-error-boundary'

/**
 * 計算実行〜結果/エラーのライフサイクルを表す判別共用体。
 *
 * `idle`（初期・フォーム値変更後のリセット）/ `success`（計算成功）/ `error`（ドメインエラー）の
 * 3 状態を `status` で弁別する。`result` は `success` のみ、`error` は `error` のみが持つ必須
 * プロパティであり、「両方を同時に持つ」「非 idle で両方を持たない」状態を型で排除する（Issue #108）。
 *
 * `success` の `stale` は「計算後にフォーム値が変更され、表示中の結果が現在の入力と一致しない」ことを表す
 * （Issue #9）。`run` 成功で `false`、その後のフォーム値変更で `true` になる。
 */
export type CalculationState<TResult>
  = | { status: 'idle' }
    | { status: 'success', result: TResult, stale: boolean }
    | { status: 'error', error: string }

/**
 * 計算実行〜結果/エラーのライフサイクルを集約するフック。
 *
 * `forward-form` / `inverse-form` の `onSubmit` 内で対称的に重複していた
 * 「計算 Result の成功/失敗分岐 → result/error の排他 setter → 想定外例外の
 * Error Boundary パススルー」を 1 箇所に集約する。状態は単一の
 * `CalculationState<TResult>` atom で所有し、`useFormValueChange(subscribe)` を内包して
 * フォーム値変更時の遷移（`error` → `idle`）を引き継ぐ。
 *
 * 戻り値は `CalculationState<TResult>` を spread した判別共用体 + `run`。`result` と `error` の
 * 排他不変条件は型で保証される（成功は `result` のみ、ドメインエラーは `error` のみ）。
 * **注意**: 判別子 `status` を分割代入で切り離すと narrowing が崩れる。call site は
 * `const calc = useCalculation(...)` のように union オブジェクトを保持したまま
 * `calc.status === 'success'` で判別し、ブランチ内で `calc.result` を参照すること。
 *
 * フォーム値変更時の遷移は status 別に非対称: `error` のときは `idle` へ遷移し（Alert 消滅）、
 * `success` のときは結果を保持したまま `stale: true` にする（古い結果として薄く表示する。Issue #9）。
 * `idle` と、すでに `stale` な `success` は no-op。`setState` の更新関数は no-op 時に同一参照を
 * 返すため不要な再レンダを起こさない。
 *
 * `run` は計算実行サンク（`() => Result<TResult, DomainError>`）を毎回受け取る方式。
 * 計算関数の呼び出しは呼び出し側（form）に残るため、form 単体 spec の
 * モジュールモック（`vi.mock` + `vi.fn`）がそのまま機能する。`number → 表示用
 * オブジェクト` の整形が必要な場合はサンクの戻り Result を `.map` して渡す。
 *
 * `run` の try は計算呼び出し（サンク実行）の最小範囲のみを包む。React の state
 * setter（`setState`）は Hooks API の不変条件により同期 throw しないため、`match` の
 * コールバック内 setter を try で囲う必要がない。これにより想定外例外の Boundary 委譲経路に
 * setter を巻き込まない（Issue #91 / PR #93 レビュー S-1）。
 *
 * `run` は 1 イベント内で複数回同期呼びしないこと。内包する `useThrowToErrorBoundary`
 * は同一 render サイクルで複数回呼ぶと先行の想定外例外を取りこぼす制約があるため
 * （現状の両 form は単一呼びのため実害なし）。
 *
 * @example
 * const { subscribe } = useForm()
 * const calc = useCalculation<DisplayResult>(subscribe)
 * calc.run(() => calculateXxx(...).map(value => ({ ... })))
 * if (calc.status === 'success') { ... calc.result ... }
 */
export type UseCalculationReturn<TResult> = CalculationState<TResult> & {
  run: (calc: () => Result<TResult, DomainError>) => void
  /**
   * `run` が成功またはドメインエラーに遷移した回数。計算を実行するたびに増える。
   * 計算後に結果へスクロールするトリガとして使う（Issue #19）。入力変更では増えない。
   */
  runCount: number
}

export function useCalculation<
  TResult,
  TFieldValues extends FieldValues = FieldValues,
>(subscribe: UseFormSubscribe<TFieldValues>): UseCalculationReturn<TResult> {
  const [state, setState] = useState<CalculationState<TResult>>({ status: 'idle' })
  const [runCount, setRunCount] = useState(0)
  const throwToErrorBoundary = useThrowToErrorBoundary()

  // フォーム値変更時は error なら idle へ戻し、success なら結果を保持したまま stale にする（Issue #9）。
  // idle・stale 済みの success は同一参照を返して no-op（不要な再レンダ抑止）。
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
