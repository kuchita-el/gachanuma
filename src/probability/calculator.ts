import * as v from 'valibot'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './probability'

/**
 * 指定された成功率で、累積成功確率が信頼度以上となるために必要な試行回数を計算する。
 *
 * 計算式:
 * - P(at least one success) = 1 - (1-p)^n ≥ c
 * - (1-p)^n ≤ 1 - c
 * - n ≥ log(1-c) / log(1-p)
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param confidence - 信頼度（達成確率の閾値、0 < x < 1）。省略時は 0.9
 * @returns 必要な試行回数（切り上げ済みの整数）
 * @throws {ValiError} 引数が値域外の場合
 */
export function calculateTrialCount(successRate: number, confidence: number = 0.9): number {
  const validatedRate = v.parse(validProbabilityRatioSchema, successRate)
  const validatedConfidence = v.parse(validConfidenceSchema, confidence)

  return Math.ceil(Math.log(1 - validatedConfidence) / Math.log(1 - validatedRate))
}

/**
 * 試行回数と単発成功率から、少なくとも1回成功する累積確率（ratio）を返す。
 *
 * 計算式: 1 - (1 - p)^n
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param trialCount - 試行回数（1以上の整数）
 * @returns 累積成功確率（ratio、0 < r < 1）
 * @throws {ValiError} 引数が値域外の場合
 */
export function calculateCumulativeSuccessProbability(
  successRate: number,
  trialCount: number,
): number {
  const validatedRate = v.parse(validProbabilityRatioSchema, successRate)
  const validatedCount = v.parse(validTrialCountSchema, trialCount)

  return 1 - Math.pow(1 - validatedRate, validatedCount)
}
