import { useState } from 'react'

/**
 * イベントハンドラ内で発生した想定外 throw を React Error Boundary に橋渡しするフック。
 *
 * React の Error Boundary は render / lifecycle / constructor 内の throw しか捕捉しない。
 * イベントハンドラ内の throw は捕捉対象外のため、useState の関数形セッタを使い
 * commit フェーズに throw を移送する。
 */
export function useThrowToErrorBoundary(): (error: unknown) => void {
  const [, setErrorBoundaryTrigger] = useState<Error | undefined>(undefined)
  return (error: unknown) => {
    const wrapped = error instanceof Error ? error : new Error(String(error))
    setErrorBoundaryTrigger(() => {
      throw wrapped
    })
  }
}
