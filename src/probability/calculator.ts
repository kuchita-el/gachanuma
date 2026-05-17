import { validProbabilityRatioSchema } from './probability'

/**
 * 指定された成功率で90%の確率で成功するために必要な試行回数を計算する
 *
 * 計算式:
 * - 少なくとも1回成功する確率が90%となる試行回数を求める
 * - P(at least one success) = 1 - P(all failures) = 1 - (1-p)^n ≥ 0.9
 * - (1-p)^n ≤ 0.1
 * - n ≥ log(0.1) / log(1-p) = -1 / log10(1-p)
 *
 * @param successRate - 成功率 (0から1の範囲、0と1は含まない)
 * @returns 必要な試行回数
 * @throws {ZodError} 成功率が0以下または1以上の場合
 */
export function calculateTrialCount(successRate: number): number {
  // Zodでバリデーション（エラーメッセージも一元管理）
  const validated = validProbabilityRatioSchema.parse(successRate)

  const failureRate = 1 - validated
  return Math.ceil(-1 / Math.log10(failureRate))
}

/**
 * パーセンテージ (0-100) を確率比 (0-1) に変換して試行回数を計算する
 *
 * @param successRatePercent - 成功率パーセンテージ (0から100の範囲、0と100は含まない)
 * @returns 必要な試行回数
 * @throws {Error} 成功率が0%または100%の場合
 */
export function calculateTrialCountFromPercent(successRatePercent: number): number {
  return calculateTrialCount(successRatePercent / 100)
}
