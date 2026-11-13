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
  // click が PointerEvent でないブラウザ向けに、直前の pointerdown の pointerType を記録しておく
  const pointerTypeRef = useRef('')

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pointerTypeRef.current = event.pointerType
    },
    // スクロール等でタッチが取り消されると click が来ず、記録が次の click まで残ってしまう。
    // pointerleave では消さない。タッチでは指を離した直後、click より前に発生するため。
    onPointerCancel: () => {
      pointerTypeRef.current = ''
    },
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault()
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      const clickPointerType = getClickPointerType(event.nativeEvent)
      const recordedPointerType = pointerTypeRef.current
      pointerTypeRef.current = ''
      // click 側の値だけに頼らないのは、iOS Safari がタップの click に 'touch' を入れるか確認できていないため。
      // click 側はキーボード由来（空文字）の判定にだけ使い、記録が残っていてもフォーカスを外さない。
      const pressedByTouch = clickPointerType !== ''
        && [clickPointerType, recordedPointerType].some(type => type === 'touch' || type === 'pen')
      if (pressedByTouch && document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur()
      }
      onClick?.()
    },
  }
}

/**
 * click の pointerType を返す。click が PointerEvent でないブラウザでは undefined。
 * キーボード（Enter による送信や Space）で押された click は空文字になる。
 */
function getClickPointerType(event: globalThis.MouseEvent): string | undefined {
  return typeof window.PointerEvent === 'function' && event instanceof window.PointerEvent
    ? event.pointerType
    : undefined
}
