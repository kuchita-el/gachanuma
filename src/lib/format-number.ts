/**
 * 表示用の数値整形関数群（計算結果・グラフ目盛り等で共有する）。
 */

// 回数・個数用の桁区切りフォーマッタ（モジュールスコープで1回だけ生成する）
const countFormatter = new Intl.NumberFormat('ja-JP')

/**
 * 回数・個数を桁区切り付きの文字列に整形する（例: 46050 → 「46,050」）。
 *
 * 万単位の補助表記（「約4.6万回」等）はスコープ外（Issue #14）。
 */
export function formatCount(n: number): string {
  return countFormatter.format(n)
}

/** `toFixed(2)` で「100.00」に丸まる下限（percent 換算） */
const UPPER_PERCENT_THRESHOLD = 99.995
/** 小数2桁で表示する下限（percent 換算）。これ未満は `toFixed(2)` で「0.00」に潰れる */
const LOWER_PERCENT_THRESHOLD = 0.005

// 極小値は有効数字2桁で表示する（末尾の 0 は出さない）
const smallPercentFormatter = new Intl.NumberFormat('ja-JP', {
  maximumSignificantDigits: 2,
})

/**
 * 確率（ratio: 0〜1）をパーセント表記の文字列に整形する。
 *
 * - 99.995% 以上（`toFixed(2)` で 100.00 になる範囲。浮動小数点で ratio が 1 に丸まったケースを含む）は「99.99%超」
 * - 0.005% 以上 99.995% 未満は小数2桁（例: 「63.40%」）
 * - 0% より大きく 0.005% 未満は有効数字2桁（例: 「0.0001%」）
 * - 0% 以下（極小確率のアンダーフロー）は「0.01%未満」
 *
 * 真値が 100% 未満なのに「100%」、0 より大きいのに「0%」と誤読される表示を避ける（Issue #11）。
 */
export function formatProbabilityPercent(ratio: number): string {
  const percent = ratio * 100
  if (percent >= UPPER_PERCENT_THRESHOLD) {
    return '99.99%超'
  }
  if (percent >= LOWER_PERCENT_THRESHOLD) {
    return `${percent.toFixed(2)}%`
  }
  if (percent > 0) {
    return `${smallPercentFormatter.format(percent)}%`
  }
  return '0.01%未満'
}
