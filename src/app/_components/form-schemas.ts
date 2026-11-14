import * as v from 'valibot'
import {
  validPityCountSchema,
  validTargetCountSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

/** 信頼度の既定値（%）。フォームの初期値とグラフの基準線で共有する */
export const DEFAULT_CONFIDENCE_PERCENT = 90

/**
 * 数値入力欄の文字列から表記ゆれを取り除く（Issue #13）。
 *
 * 入力欄は type="text" のため、IME の全角数字（"１０" / "０．５"）がそのまま入る。
 * 全角の数字・ピリオド・マイナス・プラスを半角にし、前後の空白（全角空白を含む）を取り除く。
 * 数値として正しいかどうかは判定しない（呼び出し側のスキーマが判定する）。
 *
 * NFKC 正規化は使わない。"①" → "1"、"²" → "2" のような互換文字まで数値として通してしまうため。
 */
export function normalizeNumericInput(input: string): string {
  // 全角英数記号（U+FF01〜U+FF5E）は対応する ASCII と 0xFEE0 ずれている
  return input
    .replace(/[０-９．－＋]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .trim()
}

/**
 * フォーム入力（文字列または数値）を数値に変換するスキーマ。
 *
 * 文字列は、全体が10進数の表記になっているときだけ受け付ける。parseFloat を使わないのは、
 * 先頭だけを解釈して "12abc" → 12、"5,000" → 5、"1e2" → 100、"0x10" → 0、"Infinity" → Infinity のように、
 * ユーザーが意図しない値が黙って通ってしまうため。
 *
 * どの分岐で失敗しても、メッセージは「数値を指定してください。」にそろえる。
 * 数値が直接渡された場合は NaN / Infinity も通る点に注意。
 */
export const numericInputSchema = v.union(
  [
    v.pipe(v.string(), v.transform(normalizeNumericInput), v.decimal(), v.transform(Number)),
    v.number(),
  ],
  '数値を指定してください。',
)

/**
 * 成功率（%、0より大きく100未満）を検証し、計算層の比率 ProbabilityRatio に変換するスキーマ。
 *
 * 値域は比率（0 < r < 1）で判定し、エラー文言は入力に合わせて % で表す（Issue #114）。
 * 出力はそのまま計算関数に渡せる（onSubmit で再検証しない）。
 */
export const probabilityPercentageSchema = v.pipe(
  numericInputSchema,
  v.transform(percentToRatio),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(1, '0より大きく100未満の数値を指定してください。'),
  v.brand('ProbabilityRatio'),
)

/**
 * 信頼度（%、0より大きく100未満の整数）を検証し、計算層の比率 ConfidenceRatio に変換するスキーマ。
 *
 * 整数かどうかは、入力文字列に小数点があるかで判定する（"90.0" も整数とみなさない。Issue #114）。
 * 検証の順序は「数値 → 整数 → 値域」。順序を変えると、150.5 などで最初に出るメッセージが変わる。
 */
export const confidencePercentageSchema = v.pipe(
  // numericInputSchema を使わないのは、整数チェックで小数点の有無を見るために、数値に変換する前の
  // 文字列が必要なため。受け付ける表記は numericInputSchema と同じにしているので、変更するときは両方そろえる。
  // 文字列分岐の末尾にある恒等 transform を消すと、union のメッセージではなく
  // v.decimal() の既定メッセージ（"Invalid decimal"）が出てしまう。
  // 整数チェックを union の中に置くと、整数でないときも「数値を指定してください。」になってしまう。
  v.union(
    [v.pipe(v.string(), v.transform(normalizeNumericInput), v.decimal(), v.transform(s => s)), v.number()],
    '数値を指定してください。',
  ),
  v.check(
    input => (typeof input === 'number' ? Number.isInteger(input) : !input.includes('.')),
    '整数を指定してください。',
  ),
  v.transform(Number),
  v.transform(percentToRatio),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(1, '0より大きく100未満の数値を指定してください。'),
  v.brand('ConfidenceRatio'),
)

/** 目標成功回数（1〜100 の整数）のスキーマ。整数・値域の検証は計算層のスキーマと共有する */
export const targetCountInputSchema = v.pipe(
  numericInputSchema,
  validTargetCountSchema,
)

/**
 * 天井すり抜け率（%、0以上100以下）を検証し、計算層の比率 SlipRateRatio に変換するスキーマ。
 *
 * 0% は天井で必ず成功、100% は天井の回で必ず外れる（天井の効果がない）。両端を含む点が成功率と異なる。
 */
export const slipRatePercentageSchema = v.pipe(
  numericInputSchema,
  v.transform(percentToRatio),
  v.minValue(0, '0以上100以下の数値を指定してください。'),
  v.maxValue(1, '0以上100以下の数値を指定してください。'),
  v.brand('SlipRateRatio'),
)

/** 試行回数（1以上の整数）のスキーマ。整数・値域の検証は計算層のスキーマと共有する */
export const trialCountInputSchema = v.pipe(
  numericInputSchema,
  validTrialCountSchema,
)

/**
 * 天井回数（1以上の整数）のスキーマ。
 * 値域は試行回数と同じだが、取り違えを型で防ぐため別のスキーマ（別ブランド）にする。
 */
export const pityCountInputSchema = v.pipe(
  numericInputSchema,
  validPityCountSchema,
)

/** パーセント（0〜100）を比率（0〜1）に変換する。値域は検証しない（スキーマ側で検証する） */
export function percentToRatio(p: number): number {
  return p / 100
}

/** 比率（0〜1）をパーセント（0〜100）に変換する。値域は検証しない */
export function ratioToPercent(r: number): number {
  return r * 100
}
