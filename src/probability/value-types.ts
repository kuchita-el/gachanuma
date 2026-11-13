import * as v from 'valibot'

/**
 * 計算層の値の型（ブランド型）とスキーマ。
 *
 * ブランドは値域ではなく意味で分ける。値域が同じでも意味が違えば別のブランドにして、
 * 引数の取り違えを型で防ぐ（例: 成功率と信頼度、試行回数と天井回数）。
 * 確率・回数の意味を持たない描画の設定値（グラフの点数など）はブランド型にしない。
 */

/** 成功率（0より大きく1未満） */
export const validProbabilityRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '成功率は0より大きい値を指定してください。'),
  v.ltValue(1, '成功率は1未満の値を指定してください。'),
  v.brand('ProbabilityRatio'),
)

export type ProbabilityRatio = v.InferOutput<typeof validProbabilityRatioSchema>

/**
 * 信頼度（0より大きく1未満）。
 * 両端を含めないのは、1 では log(1-c) が -Infinity になり、0 では答えが常に 0 回になるため。
 */
export const validConfidenceSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '信頼度は0より大きい値を指定してください。'),
  v.ltValue(1, '信頼度は1未満の値を指定してください。'),
  v.brand('ConfidenceRatio'),
)

export type ConfidenceRatio = v.InferOutput<typeof validConfidenceSchema>

/** 天井すり抜け率（0以上1以下）。0 は天井で必ず成功、1 は天井が無効なのと同じ */
export const validSlipRateRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.minValue(0, 'すり抜け率は0以上の値を指定してください。'),
  v.maxValue(1, 'すり抜け率は1以下の値を指定してください。'),
  v.brand('SlipRateRatio'),
)

export type SlipRateRatio = v.InferOutput<typeof validSlipRateRatioSchema>

/** 試行回数（1以上の整数）。グラフの X 軸上の値もこの型で扱う */
export const validTrialCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('試行回数は整数を指定してください。'),
  v.minValue(1, '試行回数は1以上を指定してください。'),
  v.brand('TrialCount'),
)

export type TrialCount = v.InferOutput<typeof validTrialCountSchema>

/** 目標成功回数（1〜100 の整数）。上限 100 は表示と計算精度の両方から決めた */
export const validTargetCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('目標成功回数は整数を指定してください。'),
  v.minValue(1, '目標成功回数は1以上を指定してください。'),
  v.maxValue(100, '目標成功回数は100以下を指定してください。'),
  v.brand('TargetCount'),
)

export type TargetCount = v.InferOutput<typeof validTargetCountSchema>

/** 天井回数（成功が保証されるまでの試行回数、1以上の整数）。値域は試行回数と同じだが別のブランドにする */
export const validPityCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('天井回数は整数を指定してください。'),
  v.minValue(1, '天井回数は1以上を指定してください。'),
  v.brand('PityCount'),
)

export type PityCount = v.InferOutput<typeof validPityCountSchema>

/**
 * 累積成功率（少なくとも1回成功する確率、0より大きく1以下）。
 * 0 は含めない（成功率が極小で表せないときはエラーにする）。1 は含める（100% に十分近い値が 1 に丸まるため）。
 */
export const validCumulativeSuccessRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '累積成功率は0より大きい値を指定してください。'),
  v.maxValue(1, '累積成功率は1以下の値を指定してください。'),
  v.brand('CumulativeSuccessRatio'),
)

export type CumulativeSuccessRatio = v.InferOutput<typeof validCumulativeSuccessRatioSchema>
