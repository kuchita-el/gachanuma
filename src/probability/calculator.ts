import * as v from 'valibot'
import {
  DEFAULT_CONFIDENCE,
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './probability'

/**
 * 計算層がユーザー入力起因の失敗（数学的境界・浮動小数点境界）を表現するためのドメイン例外。
 * ValiError と並んで「ユーザー向けメッセージとして提示可能なエラー」を示す。
 * 想定外のバグ（TypeError 等）はこの型ではなく素の Error として透過する。
 */
export class CalculationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalculationError'
  }
}

/**
 * 計算結果を表す Result 型。
 * ok=true なら value、ok=false なら message（ユーザー向け）を保持。
 */
export type CalcResult
  = | { ok: true, value: number }
    | { ok: false, message: string }

/**
 * 計算関数を実行し、ドメインエラー（ValiError / CalculationError）を CalcResult に変換する共通ラッパ。
 * 想定外のエラー（TypeError 等のバグ）は再 throw し、React Error Boundary に委ねる。
 *
 * 4 つの try* 関数で重複していた catch ロジックの集約点。
 * ValiError は `issues[].message` を改行結合して全件提示する（単一 message では先頭以外が欠落するため）。
 */
export function toCalcResult(compute: () => number): CalcResult {
  try {
    return { ok: true, value: compute() }
  }
  catch (error) {
    if (error instanceof v.ValiError) {
      return { ok: false, message: error.issues.map(i => i.message).join('\n') }
    }
    if (error instanceof CalculationError) {
      return { ok: false, message: error.message }
    }
    throw error
  }
}

/**
 * 指定された成功率で、累積成功確率が信頼度以上となるために必要な試行回数を計算する。
 *
 * 計算式の導出:
 * - 単発失敗率 (1-p) の n 回連続失敗確率: (1-p)^n
 * - 少なくとも1回成功する確率: 1 - (1-p)^n ≥ c
 * - 変形: (1-p)^n ≤ 1 - c
 * - 両辺の自然対数（c, p ∈ (0,1) より log(1-c) と log(1-p) は共に負、比は正で確定）:
 *   n ≥ log(1-c) / log(1-p)
 *
 * 経緯:
 * - 旧式は信頼度 0.9 固定の `-1/log10(1-p)` だったが、信頼度を引数化するため
 *   `log(1-c)/log(1-p)` に一般化した（log10(0.1)=-1 で旧式と等価）。
 *
 * 浮動小数点境界:
 * - p が極小（例: 1e-17）の場合、IEEE754 では `1 - p` が 1 に丸まり log(1-p)=0 となるため
 *   結果が -Infinity に発散する。validProbabilityRatioSchema は `> 0` までしか保証しないため、
 *   戻り値の有限性を別途検証する。
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param confidence - 信頼度（達成確率の閾値、0 < x < 1）。省略時は DEFAULT_CONFIDENCE
 * @returns 必要な試行回数（切り上げ済みの整数）
 * @throws {ValiError} 引数が値域外の場合
 * @throws {CalculationError} 浮動小数点境界で計算結果が非有限値になった場合
 */
export function calculateTrialCount(
  successRate: number,
  confidence: number = DEFAULT_CONFIDENCE,
): number {
  const validatedRate = v.parse(validProbabilityRatioSchema, successRate)
  const validatedConfidence = v.parse(validConfidenceSchema, confidence)

  const result = Math.ceil(Math.log(1 - validatedConfidence) / Math.log(1 - validatedRate))
  if (!Number.isFinite(result)) {
    throw new CalculationError(
      '成功率が極端に小さいため試行回数を計算できません。値を見直してください。',
    )
  }
  return result
}

/**
 * calculateTrialCount の Result 型ラッパ。
 * ユーザー入力起因の失敗（ValiError / CalculationError）は Result.ok=false に変換。
 * 想定外のエラー（TypeError 等のバグ）は再 throw し、React Error Boundary に委ねる。
 *
 * 画面側はこの関数を使うことで instanceof 分岐や try/catch を書かずに済む。
 */
export function tryCalculateTrialCount(
  successRate: number,
  confidence?: number,
): CalcResult {
  return toCalcResult(() => calculateTrialCount(successRate, confidence))
}

/**
 * 試行回数と単発成功率から、少なくとも1回成功する累積確率（ratio）を返す。
 *
 * 計算式: 1 - (1 - p)^n
 *
 * 浮動小数点境界:
 * - p が極小（例: 1e-17）の場合、IEEE754 では `1 - p` が 1 に丸まり `(1-p)^n = 1`、
 *   結果として ratio が 0 になる（実数学的には 0 ではない）。これは「成功率が極端に小さく
 *   累積確率を有効桁数で表現できない」状態のため CalculationError として明示する。
 * - p が高く n が大きい場合 ratio は 1 に飽和するが、これは「100% に十分近い」として
 *   `100.00%` 表示で許容する（CalculationError は投げない）。
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param trialCount - 試行回数（1以上の整数）
 * @returns 累積成功確率（ratio、0 < r ≤ 1）
 * @throws {ValiError} 引数が値域外の場合
 * @throws {CalculationError} 浮動小数点境界で ratio が 0 に丸まった場合
 */
export function calculateCumulativeSuccessProbability(
  successRate: number,
  trialCount: number,
): number {
  const validatedRate = v.parse(validProbabilityRatioSchema, successRate)
  const validatedCount = v.parse(validTrialCountSchema, trialCount)

  const result = 1 - Math.pow(1 - validatedRate, validatedCount)
  if (!Number.isFinite(result) || result === 0) {
    throw new CalculationError(
      '成功率が極端に小さいため累積成功確率を計算できません。値を見直してください。',
    )
  }
  return result
}

/**
 * calculateCumulativeSuccessProbability の Result 型ラッパ。
 * tryCalculateTrialCount と対称の責務分離: 画面側は instanceof 分岐や try/catch を書かずに済む。
 */
export function tryCalculateCumulativeSuccessProbability(
  successRate: number,
  trialCount: number,
): CalcResult {
  return toCalcResult(() => calculateCumulativeSuccessProbability(successRate, trialCount))
}
