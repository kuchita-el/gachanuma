import { err, ok, type Result } from 'neverthrow'
import { type DomainError, parseInputOrErr } from './domain-error'
import {
  DEFAULT_CONFIDENCE,
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './probability'

/**
 * 計算結果を表す Result 型。neverthrow の `Result<T, DomainError>` の薄いエイリアス。
 *
 * 計算層は `throw` を撲滅し、ドメインエラー（バリデーション失敗・浮動小数点境界・反復上限超過）を
 * 全て `DomainError` discriminated union で表現する。想定外エラー（TypeError 等のバグ）は
 * Result に変換せず呼び出し元まで透過する（React Error Boundary に委ねる）。
 */
export type CalcResult<T = number> = Result<T, DomainError>

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
 * 浮動小数点境界:
 * - p が極小（例: 1e-17）の場合、IEEE754 では `1 - p` が 1 に丸まり log(1-p)=0 となるため
 *   結果が -Infinity に発散する。validProbabilityRatioSchema は `> 0` までしか保証しないため、
 *   戻り値の有限性を別途検証し、`NonFiniteResult` として err 返却する。
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param confidence - 信頼度（達成確率の閾値、0 < x < 1）。省略時は DEFAULT_CONFIDENCE
 * @returns ok(必要な試行回数、切り上げ済みの整数) または err(InvalidInput / NonFiniteResult)
 */
export function calculateTrialCount(
  successRate: number,
  confidence: number = DEFAULT_CONFIDENCE,
): CalcResult {
  return parseInputOrErr(validProbabilityRatioSchema, successRate).andThen(validatedRate =>
    parseInputOrErr(validConfidenceSchema, confidence).andThen((validatedConfidence) => {
      const result = Math.ceil(Math.log(1 - validatedConfidence) / Math.log(1 - validatedRate))
      if (!Number.isFinite(result)) {
        return err<number, DomainError>({ kind: 'NonFiniteResult', source: 'calculateTrialCount' })
      }
      return ok<number, DomainError>(result)
    }),
  )
}

/**
 * calculateTrialCount のエイリアス。
 * 旧 try* / 生関数の責務分離を「Result 直接返却」に統合した後も、画面・他モジュール側の
 * 既存呼び出しを変更せずに済むよう同名を維持する。
 */
export function tryCalculateTrialCount(
  successRate: number,
  confidence?: number,
): CalcResult {
  return calculateTrialCount(successRate, confidence)
}

/**
 * 試行回数と単発成功率から、少なくとも1回成功する累積確率（ratio）を返す。
 *
 * 計算式: 1 - (1 - p)^n
 *
 * 浮動小数点境界:
 * - p が極小（例: 1e-17）の場合、IEEE754 では `1 - p` が 1 に丸まり `(1-p)^n = 1`、
 *   結果として ratio が 0 になる（実数学的には 0 ではない）。これは「成功率が極端に小さく
 *   累積確率を有効桁数で表現できない」状態のため `NonFiniteResult` として err 返却する。
 * - p が高く n が大きい場合 ratio は 1 に飽和するが、これは「100% に十分近い」として
 *   `100.00%` 表示で許容する（err は返さない）。
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param trialCount - 試行回数（1以上の整数）
 * @returns ok(累積成功確率、0 < r ≤ 1) または err(InvalidInput / NonFiniteResult)
 */
export function calculateCumulativeSuccessProbability(
  successRate: number,
  trialCount: number,
): CalcResult {
  return parseInputOrErr(validProbabilityRatioSchema, successRate).andThen(validatedRate =>
    parseInputOrErr(validTrialCountSchema, trialCount).andThen((validatedCount) => {
      const result = 1 - Math.pow(1 - validatedRate, validatedCount)
      if (!Number.isFinite(result) || result === 0) {
        return err<number, DomainError>({
          kind: 'NonFiniteResult',
          source: 'calculateCumulativeSuccessProbability',
        })
      }
      return ok<number, DomainError>(result)
    }),
  )
}

/**
 * calculateCumulativeSuccessProbability のエイリアス（tryCalculateTrialCount と同様の責務）。
 */
export function tryCalculateCumulativeSuccessProbability(
  successRate: number,
  trialCount: number,
): CalcResult {
  return calculateCumulativeSuccessProbability(successRate, trialCount)
}
