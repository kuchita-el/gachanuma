import { type Result } from 'neverthrow'
import { type DomainError, domainErr, validateOrNonFinite } from './domain-error'
import {
  type ConfidenceRatio,
  type CumulativeSuccessRatio,
  type ProbabilityRatio,
  type TrialCount,
  validCumulativeSuccessRatioSchema,
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
 *   結果が -Infinity に発散する。ProbabilityRatio は `> 0` までしか保証しないため、
 *   戻り値の有限性を別途検証し、`NonFiniteResult` として err 返却する。
 *
 * @param successRate - 単発成功率（検証済みブランド値、0 < x < 1）
 * @param confidence - 信頼度（達成確率の閾値、検証済みブランド値、0 < x < 1）
 * @returns ok(必要な試行回数、切り上げ済みの整数) または err(NonFiniteResult)
 */
export function calculateTrialCount(
  successRate: ProbabilityRatio,
  confidence: ConfidenceRatio,
): CalcResult<TrialCount> {
  const result = Math.ceil(Math.log(1 - confidence) / Math.log(1 - successRate))
  if (!Number.isFinite(result)) {
    return domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' })
  }
  return validateOrNonFinite(validTrialCountSchema, result, 'calculateTrialCount')
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
 * @param successRate - 単発成功率（検証済みブランド値、0 < x < 1）
 * @param trialCount - 試行回数（検証済みブランド値、1以上の整数）
 * @returns ok(累積成功確率、0 < r ≤ 1) または err(NonFiniteResult)
 */
export function calculateCumulativeSuccessProbability(
  successRate: ProbabilityRatio,
  trialCount: TrialCount,
): CalcResult<CumulativeSuccessRatio> {
  const result = 1 - Math.pow(1 - successRate, trialCount)
  if (!Number.isFinite(result) || result === 0) {
    return domainErr({
      kind: 'NonFiniteResult',
      source: 'calculateCumulativeSuccessProbability',
    })
  }
  return validateOrNonFinite(
    validCumulativeSuccessRatioSchema,
    result,
    'calculateCumulativeSuccessProbability',
  )
}
