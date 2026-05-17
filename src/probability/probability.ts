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
 * 検証済みの確率比率型（0より大きく1未満）
 */
export type ValidProbabilityRatio = v.InferOutput<typeof validProbabilityRatioSchema>
