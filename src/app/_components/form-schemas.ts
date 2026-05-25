import * as v from 'valibot'
import { validTargetCountSchema, validTrialCountSchema } from '@/probability/probability'

/**
 * 信頼度のフォーム既定値（percent）。
 * UI 層共通の既定値として、フォーム初期値・チャートの基準線で共有する。
 */
export const DEFAULT_CONFIDENCE_PERCENT = 90

/**
 * フォーム入力（文字列）を数値型に確定するヘルパスキーマ。
 *
 * 文字列入力を v.decimal() で全体一致を強制してから Number() で数値化する。
 * 「全体一致」が肝で、parseFloat の貪欲解釈（"12abc" → 12、"5,000" → 5、"1e2"
 * → 100、"0x10" → 0、"Infinity" → Infinity、前後空白許容）を排除し、
 * UI フォームでユーザが意図しない値が無音で通過するのを防ぐ。
 *
 * 非文字列（型不一致）は v.string、全体不一致は v.decimal がそれぞれ捕捉し、
 * いずれも「数値を指定してください。」を返す。output 型は number。
 */
export const numericInputSchema = v.pipe(
  v.string('数値を指定してください。'),
  v.decimal('数値を指定してください。'),
  v.transform(Number),
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
 * 目標成功回数のフォーム入力用スキーマ。1〜100 の整数を許容。
 * 文字列→数値（numericInputSchema）＋数値→valid（validTargetCountSchema）の
 * 2 段合成。整数・値域検証はドメイン層の valid を再利用。
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
 * 2 段合成。整数・値域検証はドメイン層の valid を再利用。
 * UI フォーム（react-hook-form + valibotResolver）から呼ばれる前提。
 */
export const trialCountInputSchema = v.pipe(
  numericInputSchema,
  validTrialCountSchema,
)

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
