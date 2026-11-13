'use client'

import { useState } from 'react'

/**
 * イベントハンドラ内で起きた想定外の例外を、React の Error Boundary に渡すフック。
 * Error Boundary はレンダー中の例外しか捕捉しないため、エラーを state に保持して次のレンダーで投げ直す。
 * Error 以外の値は Error で包み、元の値を `cause` に残す。
 *
 * 制約:
 * - 同一 render サイクル内で返り値を複数回呼ばないこと。React の state バッチにより
 *   最後の呼び出しの値が勝ち、それ以前の error は失われる。
 * - 返り値は render 毎に新規生成される関数のため、`useEffect` 等の依存配列に
 *   入れないこと（無限ループになる）。
 */
export function useThrowToErrorBoundary(): (error: unknown) => void {
  const [error, setError] = useState<Error | undefined>(undefined)
  if (error) throw error
  return (e: unknown): void => {
    if (e instanceof Error) {
      setError(e)
      return
    }
    const message = typeof e === 'string' ? e : String(e)
    setError(new Error(message, { cause: e }))
  }
}
