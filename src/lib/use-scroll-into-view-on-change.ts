'use client'

import { type RefObject, useEffect } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * `key` が変わるたびに `ref` の要素を画面内へスクロールするフック（Issue #19）。
 * 計算後、画面外にある結果（またはエラー）を見える位置へ移すために使う。
 * - 要素がすでに画面内にあるときは動かない
 * - `prefers-reduced-motion: reduce` のときはアニメーションしない
 * - `key` が 0（まだ一度も計算していない）のときはスクロールしない
 *
 * `key` には計算の実行回数を渡す。結果の値を使わないのは、同じ結果での再計算でもスクロールさせるため。
 * フォーカスは移さない。結果は live region で読み上げられ、入力欄から操作を続けやすいため。
 */
export function useScrollIntoViewOnChange(
  ref: RefObject<HTMLElement | null>,
  key: number,
): void {
  useEffect(() => {
    if (key === 0) return
    ref.current?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [ref, key])
}
