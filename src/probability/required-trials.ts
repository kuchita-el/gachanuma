/** 累積成功確率が信頼度以上になるために必要な試行回数を求める */
import { type Result } from 'neverthrow'
import { type DomainError, domainErr, validateOrNonFinite } from './domain-error'
import { betai } from './incomplete-beta'
import {
  type ConfidenceRatio,
  type ProbabilityRatio,
  type TargetCount,
  type TrialCount,
  validTrialCountSchema,
} from './value-types'

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
): Result<TrialCount, DomainError> {
  const result = Math.ceil(Math.log(1 - confidence) / Math.log(1 - successRate))
  if (!Number.isFinite(result)) {
    return domainErr({ kind: 'NonFiniteResult', source: 'calculateTrialCount' })
  }
  return validateOrNonFinite(validTrialCountSchema, result, 'calculateTrialCount')
}

/** 二分探索の上限。実用域（p ≥ 0.001、targetCount ≤ 100、c ≤ 0.99）を 2 桁以上の余裕で覆う */
const MAX_ITERATIONS = 1_000_000

/**
 * 確率と信頼度を比べるときの許容誤差（Issue #58）。
 *
 * 二項確率がちょうど信頼度に等しくなる入力（例: p=0.5, target=2, c=0.5 → P=0.5）では、
 * 不完全ベータの数値誤差で確率が信頼度をわずかに下回り、答えが 1 大きくなることがある。
 * `betai` の誤差（~1e-14）より十分大きく、隣り合う k の確率差（>> 1e-12）より十分小さい値にしている。
 */
const EPS_THRESHOLD = 1e-12

/**
 * 目標成功回数 targetCount 回以上成功する確率が信頼度以上になる、最小の試行回数を返す。
 *
 * X ~ Binomial(k, p) とすると `P(X ≥ targetCount) = I_p(targetCount, k − targetCount + 1)`
 * （正則化不完全ベータ）。この確率は k について単調非減少なので、二分探索で最小の k を求める。
 * k を 1 つずつ増やして確率を足し上げる方法は、p が小さいと k が大きくなり遅いため採らない。
 *
 * targetCount が 1 のときは、`calculateTrialCount` と同じ値を返す。
 * 探索の上限までに信頼度に届かないときは `IterationLimitExceeded` を返す。
 *
 * @param successRate - 単発成功率（検証済みブランド値、0 < x < 1）
 * @param targetCount - 目標成功回数（検証済みブランド値、1〜100 の整数）
 * @param confidence - 信頼度（達成確率の閾値、検証済みブランド値、0 < x < 1）
 * @returns ok(必要な試行回数) または err(NonFiniteResult / IterationLimitExceeded)
 */
export function calculateTrialCountForMultipleSuccess(
  successRate: ProbabilityRatio,
  targetCount: TargetCount,
  confidence: ConfidenceRatio,
): Result<TrialCount, DomainError> {
  if (targetCount === 1) {
    return calculateTrialCount(successRate, confidence)
  }

  const p = successRate
  const target = targetCount
  const c = confidence

  // 期待試行回数（target/p）の 50 倍。小さすぎる値にならないよう下限を 1000 にする
  const expectedTrials = target / p
  const dynamicLimit = Math.min(MAX_ITERATIONS, Math.max(1000, Math.ceil(expectedTrials * 50)))

  const meetsThreshold = (k: number): boolean =>
    betai(target, k - target + 1, p) + EPS_THRESHOLD >= c

  if (!meetsThreshold(dynamicLimit)) {
    return domainErr({
      kind: 'IterationLimitExceeded',
      source: 'calculateTrialCountForMultipleSuccess',
    })
  }

  // 型を明示しないと TargetCount と推論され、mid + 1 を代入できない
  let lo: number = target
  let hi: number = dynamicLimit
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (meetsThreshold(mid)) {
      hi = mid
    }
    else {
      lo = mid + 1
    }
  }

  return validateOrNonFinite(validTrialCountSchema, lo, 'calculateTrialCountForMultipleSuccess')
}
