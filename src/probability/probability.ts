import * as v from 'valibot'

/**
 * 計算に使用可能な確率（0より大きく1未満）のValibotスキーマ
 * 0と1は除外される
 */
export const validProbabilityRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '成功率は0より大きい値を指定してください。'),
  v.ltValue(1, '成功率は1未満の値を指定してください。'),
)

/**
 * 確率をパーセンテージ（0-100）で表すValibotスキーマ
 * 0より大きく100未満の範囲を許可
 * 文字列からの変換に対応
 */
export const probabilityPercentageSchema = v.pipe(
  v.union([
    v.pipe(
      v.string(),
      v.transform((val) => {
        const num = parseFloat(val)
        return isNaN(num) ? val : num
      }),
    ),
    v.number(),
  ]),
  v.number('数値を指定してください。'),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 信頼度（達成確率の閾値、0より大きく1未満）のValibotスキーマ
 * 0と1は計算式が破綻するため両端を排除
 */
export const validConfidenceSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '信頼度は0より大きい値を指定してください。'),
  v.ltValue(1, '信頼度は1未満の値を指定してください。'),
)

/**
 * 試行回数（1以上の整数）のValibotスキーマ
 */
export const validTrialCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('試行回数は整数を指定してください。'),
  v.minValue(1, '試行回数は1以上を指定してください。'),
)

/**
 * 検証済みの確率比率型（0より大きく1未満）
 */
export type ValidProbabilityRatio = v.InferOutput<typeof validProbabilityRatioSchema>

/**
 * パーセンテージ（0-100）を比率（0-1）に変換する純関数。値域チェックなし。
 */
export function percentToRatio(p: number): number {
  return p / 100
}

/**
 * 比率（0-1）をパーセンテージ（0-100）に変換する純関数。値域チェックなし。
 */
export function ratioToPercent(r: number): number {
  return r * 100
}
