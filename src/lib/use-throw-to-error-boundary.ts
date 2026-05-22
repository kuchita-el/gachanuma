'use client'

import { useState } from 'react'

/**
 * イベントハンドラ内で発生した想定外 throw を React Error Boundary に橋渡しするフック。
 *
 * React の Error Boundary は render / lifecycle / constructor 内の throw しか捕捉しない。
 * イベントハンドラ内の throw は捕捉対象外のため、useState にエラーを保持し、
 * 次回 render 時に同期 throw する。Error Boundary が getDerivedStateFromError で捕捉する。
 *
 * 非 Error 値は Error にラップし、元値を `cause` に保持してデバッグ情報を残す。
 * message は `string` の場合は元値を転記、それ以外は `String(e)` で文字列化する
 * （例: `null` → `"null"`、`{ code: 42 }` → `"[object Object]"`）。
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
