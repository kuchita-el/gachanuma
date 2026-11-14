/**
 * 試行回数に対する累積達成確率の曲線（グラフのモデル）と、その評価（Issue #8）。
 *
 * 必要な試行回数の計算と、グラフに描く曲線を同じモデルから求め、グラフと計算結果を一致させる。
 */
import { type Result } from 'neverthrow'
import { calculateCumulativeSuccessProbability } from './cumulative-probability'
import { type DomainError, validateOrNonFinite } from './domain-error'
import { betai } from './incomplete-beta'
import { calculateTrialCount, calculateTrialCountForMultipleSuccess } from './required-trials'
import { calculateTrialCountWithPity } from './required-trials-with-pity'
import {
  type AchievementRatio,
  type ConfidenceRatio,
  type PityCount,
  type ProbabilityRatio,
  type SlipRateRatio,
  type TargetCount,
  type TrialCount,
  validAchievementRatioSchema,
} from './value-types'

/**
 * 累積達成確率の曲線のモデル。
 * - `single`: 少なくとも1回成功する確率
 * - `multiple`: targetCount 回以上成功する確率
 * - `pity`: 天井ありで少なくとも1回成功する確率（天井計算は1回成功のみ対応、Issue #34）
 */
export type SuccessCurve
  = | { kind: 'single', successRate: ProbabilityRatio }
    | { kind: 'multiple', successRate: ProbabilityRatio, targetCount: TargetCount }
    | { kind: 'pity', successRate: ProbabilityRatio, pityCount: PityCount, slipRate: SlipRateRatio }

const toAchievement = (value: number) =>
  validateOrNonFinite(validAchievementRatioSchema, value, 'evaluateSuccessCurve')

/**
 * trialCount 回試行したときに、曲線のモデルで目標を達成している確率を返す。
 *
 * - `single`: `1 - (1-p)^k`（`calculateCumulativeSuccessProbability` と同じ。成功率が極小なら err）
 * - `multiple`: `P(X ≥ r) = I_p(r, k − r + 1)`（k < r なら 0）。r = 1 は `single` と同じ
 * - `pity`: k < N なら `1 - (1-p)^k`、k ≥ N なら `1 - (1-p)^(k-1) × m`
 *   （`calculateTrialCountWithPity` の JSDoc の式）。成功率が極小で 0 に丸まっても err にしない。
 *   天井で確率が跳ね上がり、必要な試行回数も計算できる（天井回数になる）ため
 *
 * @param curve - 曲線のモデル（検証済みブランド値）
 * @param trialCount - 試行回数（検証済みブランド値、1以上の整数）
 * @returns ok(累積達成確率、0 ≤ r ≤ 1) または err(NonFiniteResult)
 */
export function evaluateSuccessCurve(
  curve: SuccessCurve,
  trialCount: TrialCount,
): Result<AchievementRatio, DomainError> {
  const k = trialCount
  switch (curve.kind) {
    case 'single':
      return calculateCumulativeSuccessProbability(curve.successRate, k).andThen(toAchievement)
    case 'multiple': {
      const r = curve.targetCount
      if (r === 1) {
        return evaluateSuccessCurve({ kind: 'single', successRate: curve.successRate }, k)
      }
      if (k < r) {
        return toAchievement(0)
      }
      return toAchievement(betai(r, k - r + 1, curve.successRate))
    }
    case 'pity': {
      const q = 1 - curve.successRate
      const value = k < curve.pityCount
        ? 1 - Math.pow(q, k)
        : 1 - Math.pow(q, k - 1) * curve.slipRate
      return toAchievement(value)
    }
    default: {
      const unreachable: never = curve
      return unreachable
    }
  }
}

/**
 * 曲線のモデルで、累積達成確率が信頼度以上になる最小の試行回数を返す。
 * モデルごとに既存の計算関数へ振り分ける。
 *
 * @param curve - 曲線のモデル（検証済みブランド値）
 * @param confidence - 信頼度（検証済みブランド値、0 < x < 1）
 * @returns ok(必要な試行回数) または err(NonFiniteResult / IterationLimitExceeded)
 */
export function calculateTrialCountOnCurve(
  curve: SuccessCurve,
  confidence: ConfidenceRatio,
): Result<TrialCount, DomainError> {
  switch (curve.kind) {
    case 'single':
      return calculateTrialCount(curve.successRate, confidence)
    case 'multiple':
      return calculateTrialCountForMultipleSuccess(curve.successRate, curve.targetCount, confidence)
    case 'pity':
      return calculateTrialCountWithPity(curve.successRate, curve.pityCount, curve.slipRate, confidence)
    default: {
      const unreachable: never = curve
      return unreachable
    }
  }
}
