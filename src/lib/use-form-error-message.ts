'use client'

import { useEffect } from 'react'
import type { FieldValues, UseFormSubscribe } from 'react-hook-form'

/**
 * react-hook-form のフォーム値が変わるたびに `onChange` を呼ぶフック。
 * `onChange` は `useCallback` 等で参照を安定させて渡すこと（変わるたびに購読し直すため）。
 *
 * `useWatch` + `useEffect` を使わないのは、依存配列に状態を含める必要があり、
 * 状態を更新した直後の再実行で `onChange` がすぐに呼ばれてしまうため。
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
