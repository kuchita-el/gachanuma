import * as v from 'valibot'

/**
 * 計算に使用可能な確率（0より大きく1未満）のValibotスキーマ
 * 0と1は除外される
 */
export const validProbabilityRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '成功率は0より大きい値を指定してください。'),
  v.ltValue(1, '成功率は1未満の値を指定してください。'),
  v.brand('ProbabilityRatio'),
)

export type ProbabilityRatio = v.InferOutput<typeof validProbabilityRatioSchema>

/**
 * 信頼度（達成確率の閾値、0より大きく1未満）のValibotスキーマ
 * c=1 で log(1-c)=-Infinity、c=0 で n=0 退化となり計算式が成立しないため両端を排除
 */
export const validConfidenceSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '信頼度は0より大きい値を指定してください。'),
  v.ltValue(1, '信頼度は1未満の値を指定してください。'),
  v.brand('ConfidenceRatio'),
)

export type ConfidenceRatio = v.InferOutput<typeof validConfidenceSchema>

/**
 * 天井すり抜け率（ratio、0以上1以下）のValibotスキーマ
 * 0 = 天井で目的キャラ確定、1 = 天井でも 100% すり抜け（天井無効と等価）。
 * 両端を許容する点が validProbabilityRatioSchema との大きな差。
 */
export const validSlipRateRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.minValue(0, 'すり抜け率は0以上の値を指定してください。'),
  v.maxValue(1, 'すり抜け率は1以下の値を指定してください。'),
  v.brand('SlipRateRatio'),
)

export type SlipRateRatio = v.InferOutput<typeof validSlipRateRatioSchema>

/**
 * 試行回数（1以上の整数）のValibotスキーマ
 * 0は累積確率0への退化、小数・負値は離散試行として非物理のため排除
 */
export const validTrialCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('試行回数は整数を指定してください。'),
  v.minValue(1, '試行回数は1以上を指定してください。'),
  v.brand('TrialCount'),
)

export type TrialCount = v.InferOutput<typeof validTrialCountSchema>

/**
 * 目標成功回数（k 回成功までに必要な試行回数を計算する際の k）のスキーマ。
 * 1〜100 の整数を許容。100 は UI 表示・計算精度の双方を考慮した上限値。
 */
export const validTargetCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('目標成功回数は整数を指定してください。'),
  v.minValue(1, '目標成功回数は1以上を指定してください。'),
  v.maxValue(100, '目標成功回数は100以下を指定してください。'),
  v.brand('TargetCount'),
)

export type TargetCount = v.InferOutput<typeof validTargetCountSchema>
