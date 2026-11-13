'use client'

import { type MouseEvent, type PointerEvent, useRef } from 'react'

/**
 * 計算ボタン・「この入力で再計算」ボタンに渡す props を返すフック（Issue #21）。
 * マウスで押したときは、押し下げで入力欄からフォーカスを奪わない。
 * タッチで押したときは、クリックの時点で入力欄のフォーカスを外し、画面のキーボードを閉じる。
 *
 * マウスの押し下げでフォーカスを奪わないのは、次の問題を防ぐため。
 * フォームは `mode: 'onBlur'` で検証するので、フォーカスが移ると入力欄の検証が走り、エラーメッセージの表示で
 * ボタンが下にずれる。押し下げと押し上げが別の要素になると click が発生せず、1回目の押下が無視される。
 *
 * タッチでフォーカスを外すのは、残したままだとキーボードが閉じず、計算結果が隠れるため。
 * タッチでは指を離した時点でクリックが確定しているので、ここで外してもクリックは無視されない。
 *
 * 次の案は採らない。
 * - エラーメッセージの領域をあらかじめ確保する: 全フィールドの下に空行が増え、見た目が変わる
 * - `mode: 'onSubmit'` にする: フォーカスアウト時にエラーを伝えられなくなる
 */
export function useKeepFocusOnPress(onClick?: () => void) {
  // click イベントの pointerType はブラウザによって取れないため、直前の pointerdown で記録する
  const pointerTypeRef = useRef('')

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pointerTypeRef.current = event.pointerType
    },
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault()
    },
    onClick: () => {
      const pointerType = pointerTypeRef.current
      // キーボード（Enter / Space）で押した場合は pointerdown が来ないため、フォーカスはそのまま
      pointerTypeRef.current = ''
      if ((pointerType === 'touch' || pointerType === 'pen') && document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur()
      }
      onClick?.()
    },
  }
}
