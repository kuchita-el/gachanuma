import * as v from 'valibot'

/**
 * 信頼度のフォーム既定値（percent）。
 * UI 層共通の既定値として、フォーム初期値・チャートの基準線で共有する。
 */
export const DEFAULT_CONFIDENCE_PERCENT = 90

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
 * 確率をパーセンテージ（0-100）で表すValibotスキーマ
 * 0より大きく100未満の範囲を許可。0/100 を含めると比率変換後に
 * validProbabilityRatioSchema の両端排除条件と整合しないため除外。
 */
export const probabilityPercentageSchema = v.pipe(
  numericInputSchema,
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 信頼度をパーセンテージ（整数、0より大きく100未満）で表すValibotスキーマ
 * 0と100は計算式の境界条件で除外。整数のみ受理（小数の信頼度は UI 仕様外）。
 */
export const confidencePercentageSchema = v.pipe(
  numericInputSchema,
  v.integer('整数を指定してください。'),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(100, '0より大きく100未満の数値を指定してください。'),
)

/**
 * 目標成功回数のフォーム入力用スキーマ。1〜100 の整数を許容。
 * 100 上限は UI 表示・計算精度の双方を考慮した validTargetCountSchema の制約と一致。
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
 * 試行回数のフォーム入力用スキーマ。1 以上の整数を許容。
 * UI フォーム（react-hook-form + valibotResolver）から呼ばれる前提。
 */
export const trialCountInputSchema = v.pipe(
  numericInputSchema,
  v.integer('試行回数は整数を指定してください。'),
  v.minValue(1, '試行回数は1以上を指定してください。'),
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
