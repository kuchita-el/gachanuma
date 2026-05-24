'use client'

import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import type { FieldValues, UseFormSubscribe } from 'react-hook-form'

/**
 * react-hook-form のフォーム値変更時にエラーメッセージを自動クリアするフック。
 *
 * 戻り値は `useState` 互換のタプル `[message, setMessage]`。マウント時に
 * `subscribe({ formState: { values: true }, callback })` で購読し、フォーム値が
 * 変化するたびに `setMessage(undefined)` を発火する。unmount 時には useEffect
 * cleanup 経由で subscribe の戻り値（unsubscribe 関数）が呼ばれる。
 *
 * 用途はエラーメッセージ専用。成功・情報メッセージには使わない（UI 仕様が異なるため）。
 *
 * `useWatch + useEffect` を採用しない理由: 同パターンは依存配列に `message` を含める
 * 必要があり、`setMessage(msg)` 直後の再 effect でガード通過 → 即 `undefined` 化となり
 * Alert が一瞬で消える不具合がある。`subscribe` はフォーム値の変化時にのみ callback を
 * 発火するため、setter で立てた message が直後に消える事象が構造的に発生しない。
 *
 * @example
 * const { subscribe } = useForm()
 * const [calculationError, setCalculationError] = useFormErrorMessage(subscribe)
 */
export function useFormErrorMessage<T extends FieldValues>(
  subscribe: UseFormSubscribe<T>,
  initial?: string,
): readonly [string | undefined, Dispatch<SetStateAction<string | undefined>>] {
  const [message, setMessage] = useState<string | undefined>(initial)
  useEffect(() => {
    return subscribe({
      formState: { values: true },
      callback: () => setMessage(undefined),
    })
  }, [subscribe])
  return [message, setMessage] as const
}
