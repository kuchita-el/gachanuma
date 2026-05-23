import * as v from 'valibot'

/**
 * フォーム文字列入力を数値型に変換するヘルパスキーマ。union で文字列または数値を受け、
 * 文字列の場合は parseFloat で数値化し、最終的に v.number('数値を指定してください。')
 * で数値型を確定する。parseFloat 失敗時は元の文字列が v.number に渡り、
 * 「数値を指定してください。」メッセージで弾かれる。output 型は number。
 */
export const numericInputSchema = v.pipe(
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
)

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
  numericInputSchema,
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 信頼度（達成確率の閾値、0より大きく1未満）のValibotスキーマ
 * c=1 で log(1-c)=-Infinity、c=0 で n=0 退化となり計算式が成立しないため両端を排除
 */
export const validConfidenceSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '信頼度は0より大きい値を指定してください。'),
  v.ltValue(1, '信頼度は1未満の値を指定してください。'),
)

/**
 * 天井すり抜け率（ratio、0以上1以下）のValibotスキーマ
 * 0 = 天井で目的キャラ確定、1 = 天井でも 100% すり抜け（天井無効と等価）。
 * 両端を許容する点が validProbabilityRatioSchema との大きな差。
 */
export const validSlipRateRatioSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.minValue(0, 'すり抜け率は0以上の値を指定してください。'),
  v.maxValue(1, 'すり抜け率は1以下の値を指定してください。'),
)

/**
 * 信頼度をパーセンテージ（整数、0より大きく100未満）で表すValibotスキーマ
 * 0と100は計算式の境界条件で除外。整数のみ受理し、文字列からの変換に対応。
 */
export const confidencePercentageSchema = v.pipe(
  numericInputSchema,
  v.integer('整数を指定してください。'),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 試行回数（1以上の整数）のValibotスキーマ
 * 0は累積確率0への退化、小数・負値は離散試行として非物理のため排除
 */
export const validTrialCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('試行回数は整数を指定してください。'),
  v.minValue(1, '試行回数は1以上を指定してください。'),
)

/**
 * 目標成功回数（k 回成功までに必要な試行回数を計算する際の k）のスキーマ。
 * 1〜100 の整数を許容。100 は UI 表示・計算精度の双方を考慮した上限値。
 */
export const validTargetCountSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('目標成功回数は整数を指定してください。'),
  v.minValue(1, '目標成功回数は1以上を指定してください。'),
  v.maxValue(100, '目標成功回数は100以下を指定してください。'),
)

/**
 * 目標成功回数のフォーム入力用スキーマ。文字列入力を整数に変換し、1〜100 の整数を許容。
 */
export const targetCountInputSchema = v.pipe(
  numericInputSchema,
  v.integer('目標成功回数は整数を指定してください。'),
  v.minValue(1, '目標成功回数は1以上を指定してください。'),
  v.maxValue(100, '目標成功回数は100以下を指定してください。'),
)

/**
 * 天井すり抜け率（percent、0以上100以下）のフォーム入力用スキーマ。
 * 0% = 天井で目的キャラ確定、100% = 天井無効。両端を許容する点が
 * probabilityPercentageSchema との差。
 */
export const slipRatePercentageSchema = v.pipe(
  numericInputSchema,
  v.minValue(0, '0以上100以下の数値を指定してください。'),
  v.maxValue(100, '0以上100以下の数値を指定してください。'),
)

/**
 * 試行回数のフォーム入力用スキーマ。文字列入力を整数に変換し、1以上の整数を許容。
 * UI フォーム（react-hook-form + valibotResolver）から呼ばれる前提。
 */
export const trialCountInputSchema = v.pipe(
  numericInputSchema,
  v.integer('試行回数は整数を指定してください。'),
  v.minValue(1, '試行回数は1以上を指定してください。'),
)

/**
 * 信頼度のデフォルト値。
 * 旧 calculateTrialCount 仕様の90%固定を後方互換として維持。
 * UI 表示文言「{X}%の確率で成功するために必要な試行回数」と連動する。
 */
export const DEFAULT_CONFIDENCE = 0.9

/**
 * 検証済みの確率比率型（0より大きく1未満）
 */
export type ValidProbabilityRatio = v.InferOutput<typeof validProbabilityRatioSchema>

/**
 * パーセンテージ（0-100）を比率（0-1）に変換する純関数。
 * 値域チェックは行わない。呼び出し側で probabilityPercentageSchema 等で事前検証する前提。
 * （単位変換に副作用を持たせず、検証はスキーマに一元化する責務分離のため）
 */
export function percentToRatio(p: number): number {
  return p / 100
}

/**
 * 比率（0-1）をパーセンテージ（0-100）に変換する純関数。
 * 値域チェックは行わない。呼び出し側で validProbabilityRatioSchema 等で事前検証する前提。
 */
export function ratioToPercent(r: number): number {
  return r * 100
}
