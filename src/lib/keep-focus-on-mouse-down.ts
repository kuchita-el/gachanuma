import type { MouseEvent } from 'react'

/**
 * ボタンの押し下げで、入力欄からフォーカスを奪わないためのイベントハンドラ（Issue #21）。
 * 計算ボタン・「この入力で再計算」ボタンの `onMouseDown` に渡す。
 *
 * フォームは `mode: 'onBlur'` で検証するため、押し下げでフォーカスが移ると入力欄の検証が走り、
 * エラーメッセージの表示でボタンが下にずれる。押し下げと押し上げが別の要素になると click が
 * 発生せず、1回目の押下が無視されてしまう。キーボード操作（Tab → Enter / Space）には影響しない。
 *
 * 次の案は採らない。
 * - エラーメッセージの領域をあらかじめ確保する: 全フィールドの下に空行が増え、見た目が変わる
 * - `mode: 'onSubmit'` にする: フォーカスアウト時にエラーを伝えられなくなる
 */
export function keepFocusOnMouseDown(event: MouseEvent<HTMLElement>): void {
  event.preventDefault()
}
