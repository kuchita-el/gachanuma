/** 表示用の数値整形（計算結果とグラフの目盛りで共有する） */

const countFormatter = new Intl.NumberFormat('ja-JP')

/** 回数を桁区切り付きの文字列にする（例: 46050 → 「46,050」） */
export function formatCount(n: number): string {
  return countFormatter.format(n)
}

/** `toFixed(2)` で「100.00」に丸まる下限（percent 換算） */
const UPPER_PERCENT_THRESHOLD = 99.995
/** 小数2桁で表示する下限（percent 換算）。これ未満は `toFixed(2)` で「0.00」に潰れる */
const LOWER_PERCENT_THRESHOLD = 0.005
/**
 * 数値で表示する下限（percent 換算）。
 * 累積確率 `1 - (1 - p)^n` は極小域で桁落ちし、有効数字2桁でも誤った値に見えるため、
 * これ未満は「0.000001%未満」とまとめる。表示幅（モバイルの `text-3xl`）も抑えられる。
 */
const MIN_DISPLAY_PERCENT = 0.000001

const smallPercentFormatter = new Intl.NumberFormat('ja-JP', {
  maximumSignificantDigits: 2,
})

/**
 * 確率（比率 0〜1）をパーセント表記の文字列にする。
 *
 * - 99.995% 以上は「99.99%超」（浮動小数点で比率が 1 に丸まった場合を含む）
 * - 0.005% 以上 99.995% 未満は小数2桁（例: 「63.40%」）
 * - 0.000001% 以上 0.005% 未満は有効数字2桁（例: 「0.0001%」）
 * - 0.000001% 未満は「0.000001%未満」
 *
 * 100% 未満なのに「100%」、0 より大きいのに「0%」と表示して誤解させないため（Issue #11）。
 */
export function formatProbabilityPercent(ratio: number): string {
  const percent = ratio * 100
  if (percent >= UPPER_PERCENT_THRESHOLD) {
    return '99.99%超'
  }
  if (percent >= LOWER_PERCENT_THRESHOLD) {
    return `${percent.toFixed(2)}%`
  }
  if (percent >= MIN_DISPLAY_PERCENT) {
    return `${smallPercentFormatter.format(percent)}%`
  }
  // 0 以下も含む。計算層は 0 を err にするので渡らないはずだが、「0%」とは表示しない
  return '0.000001%未満'
}
