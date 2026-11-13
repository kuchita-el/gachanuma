import type { MouseEvent } from 'react'

/**
 * ボタンを押し下げたときに、フォーカスを入力欄から移さないためのイベントハンドラ。
 * 計算ボタン・「この入力で再計算」ボタンの `onMouseDown` に渡す。
 *
 * フォームは `mode: 'onBlur'` で検証するため、押し下げでフォーカスが移ると入力欄の検証が走り、
 * エラーメッセージの表示でボタンが下にずれる。すると押し下げと押し上げが別の要素になり、
 * click が発生せず1回目の押下が無視される。押し下げの既定動作（フォーカス移動）を止めれば
 * 検証は submit 時の1回だけになり、click が確実に届く。submit 時の検証で不正があれば
 * react-hook-form が最初のエラーフィールドへフォーカスを移す（Issue #21）。
 *
 * キーボード操作（Tab でボタンへ移動 → Enter / Space）には影響しない。
 */
export function keepFocusOnMouseDown(event: MouseEvent<HTMLElement>): void {
  event.preventDefault()
}
