/**
 * 天井（一定回数で成功が保証される仕組み）を考慮して、少なくとも1回成功するために必要な試行回数を求める。
 *
 * 計算式（k は試行回数、p は実効排出率、N は天井回数、m は天井すり抜け率）:
 * - k < N: P(k) = 1 - (1-p)^k （通常抽選のみ）
 * - k ≥ N: P(k) = 1 - (1-p)^(k-1) × m （N 回目試行は天井確定枠で抽選、成功 1-m / 失敗 m）
 *
 * 信頼度 c に対し P(k) ≥ c を満たす最小の k を返す。
 *
 * 解は次の場合分けで閉形式に求まる（kNoPity は天井なしで必要な試行回数）。
 * - kNoPity < N: 天井に届く前に信頼度に達するので kNoPity
 * - m ≤ 1-c（m = 0 を含む）: k = N で P(N) ≥ c となるので N
 * - m > 1-c: k = max(N, ceil(log((1-c)/m) / log(1-p)) + 1)
 *
 * p が極小で天井なしの計算が `NonFiniteResult` になっても、m ≤ 1-c なら天井で信頼度に届くので N を返す。
 */
import { err, ok, type Result } from 'neverthrow'
import { calculateTrialCount } from './required-trials'
import { type DomainError, domainErr, validateOrNonFinite } from './domain-error'
import {
  type ConfidenceRatio,
  type PityCount,
  type ProbabilityRatio,
  type SlipRateRatio,
  type TrialCount,
  validTrialCountSchema,
} from './value-types'

/**
 * 天井込みでの累積成功確率が信頼度以上となる最小の試行回数を返す。
 *
 * @param successRate - 単発実効排出率（検証済みブランド値、0 < x < 1）
 * @param pityCount - 天井回数（検証済みブランド値、1以上の整数）
 * @param slipRate - 天井すり抜け率（検証済みブランド値、0 ≤ x ≤ 1、両端含む）
 * @param confidence - 信頼度（達成確率の閾値、検証済みブランド値、0 < x < 1）
 * @returns ok(必要な試行回数) または err(NonFiniteResult)
 */
export function calculateTrialCountWithPity(
  successRate: ProbabilityRatio,
  pityCount: PityCount,
  slipRate: SlipRateRatio,
  confidence: ConfidenceRatio,
): Result<TrialCount, DomainError> {
  // 天井回数を試行回数として返すため、ブランドを PityCount から TrialCount に付け替える
  const pityAsTrialCount = (): Result<TrialCount, DomainError> =>
    validateOrNonFinite(validTrialCountSchema, pityCount, 'calculateTrialCountWithPity')

  return calculateTrialCount(successRate, confidence)
    .orElse((error) => {
      // m ≤ 1-c なら `(1-p)^(N-1) × m ≤ m ≤ 1-c` より P(N) ≥ c。それ以外のエラーは救えない
      if (error.kind === 'NonFiniteResult' && slipRate <= 1 - confidence) {
        return pityAsTrialCount()
      }
      return err(error)
    })
    .andThen((kNoPity) => {
      if (kNoPity < pityCount) {
        return ok(kNoPity)
      }

      // m ≤ 1-c なら k = N で P(N) ≥ c が成り立つ
      if (slipRate === 0 || slipRate <= 1 - confidence) {
        return pityAsTrialCount()
      }

      // m > 1-c: (1-p)^(k-1) × m ≤ 1-c より k ≥ log((1-c)/m) / log(1-p) + 1
      const kCandidate
        = Math.ceil(
          Math.log((1 - confidence) / slipRate) / Math.log(1 - successRate),
        ) + 1
      const result = Math.max(pityCount, kCandidate)

      if (!Number.isFinite(result)) {
        return domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCountWithPity' })
      }
      return validateOrNonFinite(validTrialCountSchema, result, 'calculateTrialCountWithPity')
    })
}
