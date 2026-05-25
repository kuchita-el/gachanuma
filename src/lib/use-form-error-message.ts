'use client'

import { useEffect } from 'react'
import type { FieldValues, UseFormSubscribe } from 'react-hook-form'

/**
 * react-hook-form のフォーム値変更を購読し、変更のたびに渡されたコールバックを発火する汎用フック。
 *
 * マウント時に `subscribe({ formState: { values: true }, callback: onChange })` で購読し、
 * フォーム値が変化するたびに `onChange` を呼ぶ。unmount 時には useEffect cleanup 経由で
 * subscribe の戻り値（unsubscribe 関数）が呼ばれる。
 *
 * 「フォーム値変更時にエラーメッセージをクリアする」専用フックを、`useCalculation` の状態遷移
 * （`status==='error'` のとき `idle` へ遷移）に転用するため、無条件の `setMessage(undefined)` を
 * 任意の `onChange` コールバック発火へ一般化した（Issue #108）。値の保持はフックの責務外とし、
 * 遷移規律は呼び出し側が `onChange` 内で決める。
 *
 * `useWatch + useEffect` を採用しない理由: 同パターンは依存配列に状態を含める必要があり、
 * 状態セット直後の再 effect で即発火する不具合がある。`subscribe` API は安定参照の
 * `subscribe` 関数に依存して購読登録するため、安定参照の `onChange`（呼び出し側で `useCallback`
 * 等により安定化する）と併せれば再購読が走らない。
 *
 * @example
 * const { subscribe } = useForm()
 * useFormValueChange(subscribe, useCallback(() => setState(...), []))
 */
export function useFormValueChange<T extends FieldValues>(
  subscribe: UseFormSubscribe<T>,
  onChange: () => void,
): void {
  useEffect(() => {
    return subscribe({
      formState: { values: true },
      callback: onChange,
    })
  }, [subscribe, onChange])
}
