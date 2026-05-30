import * as v from 'valibot'
import {
  validPityCountSchema,
  validTargetCountSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

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
 * 確率をパーセンテージ（0より大きく100未満）で受け取り、計算層の比率（ProbabilityRatio）へ
 * 変換するフォーム入力用スキーマ。
 *
 * 値域の単一定義は ratio 側（0 < r < 1）に置く（Issue #114: 所有モデル(b)）。入力 percent を
 * numericInputSchema で数値化 → percentToRatio で ratio 化 → ratio 値域検証 → ProbabilityRatio
 * へブランド化。onSubmit 側は再 parse せず本スキーマの branded 出力を直接消費する。
 * FormMessage 表示は percent 文言（「0より大きく100未満の数値を指定してください。」）を維持するため、
 * 値域メッセージは percent 系を割り当てる（値域判定は ratio、文言は percent の責務分離）。
 */
export const probabilityPercentageSchema = v.pipe(
  numericInputSchema,
  v.transform(percentToRatio),
  v.gtValue(0, '0より大きく100未満の数値を指定してください。'),
  v.ltValue(1, '0より大きく100未満の数値を指定してください。'),
  v.brand('ProbabilityRatio'),
)

/**
 * 信頼度をパーセンテージ（整数、0より大きく100未満）で受け取り、計算層の比率（ConfidenceRatio）へ
 * 変換するフォーム入力用スキーマ。
 *
 * 整数性は「入力文字列の小数桁数=0」として検証する（Issue #114: 案B）。数値ドメインの v.integer は
 * 廃し、percent/ratio いずれにも整数縛りを二重に持たせない。小数点を含む表記（"90.5" / "90.0" 等）は
 * 「整数を指定してください。」で弾く。非数値・空文字は union が「数値を指定してください。」を返す。
 * アクション順序は「数値 → 整数 → 値域」を維持（順序を変えると 150.5 等で先頭メッセージが変わる）。
 * 値域検証・ブランド化は probabilityPercentageSchema と同思想（ratio 単一定義 + percent 文言維持）。
 */
export const confidencePercentageSchema = v.pipe(
  // 数値性は string→decimal / number の union で担保し、非数値・空文字は単一の
  // 「数値を指定してください。」を返す。この union は numericInputSchema と同一の数値受理仕様を
  // 意図的に複製したもの（整数チェックを挟むため numericInputSchema をそのまま使えない）。
  // numericInputSchema 側の数値受理仕様（v.decimal）を変更する際は本スキーマも追従させること。
  // 文字列分岐末尾の恒等 transform（string→string）は
  // 2 つの役割を持つ:
  //   1. valibot union が分岐内ステップ（v.decimal）の既定メッセージではなく union メッセージを
  //      採用する条件を満たす（transform を持たないと "Invalid decimal" が漏れる）。
  //   2. 検証後も生文字列を保持し、後続の整数チェックで小数点の有無を判定できるようにする。
  // 整数チェックは union の外に置く。union 内に置くと整数違反まで union メッセージに飲み込まれ
  // 「整数を指定してください。」を返せないため。Input 型は string|number を維持し、branded ratio
  // 出力がフォーム値（Input）へ代入可能な状態（Control 型整合）を保つ。
  v.union(
    [v.pipe(v.string(), v.decimal(), v.transform(s => s)), v.number()],
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
 * 天井すり抜け率をパーセンテージ（0以上100以下）で受け取り、計算層の比率（SlipRateRatio）へ
 * 変換するフォーム入力用スキーマ。
 *
 * 0% = 天井で目的キャラ確定、100% = 天井無効。両端を許容する点が probabilityPercentageSchema との差。
 * 値域の単一定義は ratio 側（0 ≦ r ≦ 1）。FormMessage 表示は percent 文言（「0以上100以下の数値を
 * 指定してください。」）を維持する。onSubmit 側は再 parse せず branded 出力を直接消費する。
 */
export const slipRatePercentageSchema = v.pipe(
  numericInputSchema,
  v.transform(percentToRatio),
  v.minValue(0, '0以上100以下の数値を指定してください。'),
  v.maxValue(1, '0以上100以下の数値を指定してください。'),
  v.brand('SlipRateRatio'),
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
 * 天井回数のフォーム入力用スキーマ。1 以上の整数を許容。
 * 文字列→数値（numericInputSchema）＋数値→valid（validPityCountSchema）の 2 段合成。
 * 試行回数（trialCountInputSchema）とは別概念のため専用スキーマを持つ（方針A）。
 */
export const pityCountInputSchema = v.pipe(
  numericInputSchema,
  validPityCountSchema,
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
