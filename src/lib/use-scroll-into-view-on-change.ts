'use client'

import { type RefObject, useEffect } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * `key` が変わるたびに `ref` の要素を画面内へスクロールするフック（Issue #19）。
 *
 * 計算結果（またはエラー）を、計算ボタンを押した後に見える位置へ移すために使う。フォーカスは移さない。
 * - `block: 'nearest'` のため、要素がすでに画面内にあるときは動かない
 * - `prefers-reduced-motion: reduce` のときはアニメーションしない（`behavior: 'auto'`）
 * - `key` が初期値 0 のとき（まだ一度も計算していない）はスクロールしない
 *
 * `key` には計算の実行回数のように「実行のたびに増える値」を渡す。同じ結果での再計算でもスクロールさせるため、
 * 結果の値そのものではなく回数を使う。入力変更（古い結果の表示）では `key` が変わらないため、スクロールしない。
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
