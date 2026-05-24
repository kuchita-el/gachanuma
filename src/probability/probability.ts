import * as v from 'valibot'

/**
 * フォーム入力（文字列または数値）を数値型に確定するヘルパスキーマ。
 *
 * 文字列分岐は v.decimal() で全体一致を強制してから Number() で数値化する。
 * 「全体一致」が肝で、parseFloat の貪欲解釈（"12abc" → 12、"5,000" → 5、"1e2"
 * → 100、"0x10" → 0、"Infinity" → Infinity、前後空白許容）を排除し、
 * UI フォームでユーザが意図しない値が無音で通過するのを防ぐ。
 *
 * 失敗時のメッセージは union 自体に紐づけ、文字列分岐・数値分岐どちらの失敗でも
 * 単一の「数値を指定してください。」を返す。output 型は number（有限値とは限らない点に
 * 注意。NaN/Infinity が数値リテラルとして直接渡された場合は通過する）。
 */
export const numericInputSchema = v.union(
  [
    v.pipe(v.string(), v.decimal(), v.transform(Number)),
    v.number(),
  ],
  '数値を指定してください。',
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
 * 確率パーセンテージ（数値、0より大きく100未満）の値域検証スキーマ。
 * probabilityPercentageSchema から値域検証の責務を移送したもの。
 * ratio 系 validProbabilityRatioSchema の percent 版（両端排除条件は同一思想）。
 * percent⇔ratio の値域定義統合はスコープ外のため ratio 系から独立に定義する。
 */
export const validProbabilityPercentageSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 確率をパーセンテージ（0-100）で表すフォーム入力用スキーマ。
 * 文字列→数値（numericInputSchema）＋数値→valid（validProbabilityPercentageSchema）の
 * 2 段合成。値域検証は valid 側に集約。
 */
export const probabilityPercentageSchema = v.pipe(
  numericInputSchema,
  validProbabilityPercentageSchema,
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
 * 信頼度パーセンテージ（整数、0より大きく100未満）の値域検証スキーマ。
 * confidencePercentageSchema から値域・整数検証の責務を移送したもの。
 * 整数縛りは Percentage 側のみに持たせる（ratio 系 validConfidenceSchema には追加しない）。
 * アクション順序は移送元と完全一致（integer を gtValue/ltValue の前に置く）。
 * 順序を変えると範囲外かつ非整数の入力（例 150.5）でエラーメッセージが変わる。
 */
export const validConfidencePercentageSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.integer('整数を指定してください。'),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 信頼度をパーセンテージ（整数、0より大きく100未満）で表すフォーム入力用スキーマ。
 * 文字列→数値（numericInputSchema）＋数値→valid（validConfidencePercentageSchema）の
 * 2 段合成。整数・値域検証は valid 側に集約。
 */
export const confidencePercentageSchema = v.pipe(
  numericInputSchema,
  validConfidencePercentageSchema,
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
 * 目標成功回数のフォーム入力用スキーマ。1〜100 の整数を許容。
 * 文字列→数値（numericInputSchema）＋数値→valid（validTargetCountSchema）の
 * 2 段合成。整数・値域検証は既存 valid 側を再利用。
 */
export const targetCountInputSchema = v.pipe(
  numericInputSchema,
  validTargetCountSchema,
)

/**
 * 天井すり抜け率パーセンテージ（数値、0以上100以下）の値域検証スキーマ。
 * slipRatePercentageSchema から値域検証の責務を移送したもの。
 * 0% = 天井で目的キャラ確定、100% = 天井無効。両端を許容する点が
 * validProbabilityPercentageSchema との差（ratio 系 validSlipRateRatioSchema の percent 版）。
 */
export const validSlipRatePercentageSchema = v.pipe(
  v.number('数値を指定してください。'),
  v.minValue(0, '0以上100以下の数値を指定してください。'),
  v.maxValue(100, '0以上100以下の数値を指定してください。'),
)

/**
 * 天井すり抜け率（percent、0以上100以下）のフォーム入力用スキーマ。
 * 文字列→数値（numericInputSchema）＋数値→valid（validSlipRatePercentageSchema）の
 * 2 段合成。値域検証は valid 側に集約。
 */
export const slipRatePercentageSchema = v.pipe(
  numericInputSchema,
  validSlipRatePercentageSchema,
)

/**
 * 試行回数のフォーム入力用スキーマ。1 以上の整数を許容。
 * 文字列→数値（numericInputSchema）＋数値→valid（validTrialCountSchema）の
 * 2 段合成。整数・値域検証は既存 valid 側を再利用。
 * UI フォーム（react-hook-form + valibotResolver）から呼ばれる前提。
 */
export const trialCountInputSchema = v.pipe(
  numericInputSchema,
  validTrialCountSchema,
)

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
