/**
 * 試行回数と単発成功率から、少なくとも1回成功する累積確率を求めるユースケース。
 */
import { type Result } from 'neverthrow'
import { type DomainError, domainErr, validateOrNonFinite } from './domain-error'
import {
  type CumulativeSuccessRatio,
  type ProbabilityRatio,
  type TrialCount,
  validCumulativeSuccessRatioSchema,
} from './value-types'

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
): Result<CumulativeSuccessRatio, DomainError> {
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
