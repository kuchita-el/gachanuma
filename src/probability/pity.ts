/**
 * 天井（保証排出）の考慮を入れた「目的キャラ1個を1回以上引くために必要な試行回数」を求める。
 *
 * 計算式（k は試行回数、p は実効排出率、N は天井回数、m は天井すり抜け率）:
 * - k < N: P(k) = 1 - (1-p)^k （通常抽選のみ）
 * - k ≥ N: P(k) = 1 - (1-p)^(k-1) × m （N 回目試行は天井確定枠で抽選、成功 1-m / 失敗 m）
 *
 * 信頼度 c に対し P(k) ≥ c を満たす最小の k を返す。
 *
 * 計算方針: 閉形解（O(1)）。指数関数の単調性を利用してケース分析:
 * 1. kNoPity = calculateTrialCount(p, c) を取得
 *    - kNoPity < N なら k<N 領域で解、kNoPity を返す
 *    - kNoPity ≥ N なら k≥N 領域でケース分析
 * 2. k≥N 領域のケース分析:
 *    - m = 0: P(N) = 1 で確定。k = N
 *    - 0 < m ≤ 1-c: P(N) ≥ c が k=N で成立。k = N
 *    - m > 1-c: k = max(N, ceil(log((1-c)/m) / log(1-p)) + 1)
 *
 * 早期 short-circuit（p 極小ガード）:
 * - p 極小で calculateTrialCount が CalculationError を吐く境界では、m=0 なら天井で確定するため N を返す。
 *   m > 0 の場合は通常抽選が無効化されるほどの極小 p なので CalculationError を透過させる。
 */
import * as v from 'valibot'
import { CalculationError, calculateTrialCount } from './calculator'
import type { CalcResult } from './calculator'
import {
  DEFAULT_CONFIDENCE,
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTrialCountSchema,
} from './probability'

/**
 * 天井込みでの累積成功確率が信頼度以上となる最小の試行回数を返す。
 *
 * @param successRate - 単発実効排出率（0 < x < 1）
 * @param pityCount - 天井回数（1以上の整数）
 * @param slipRate - 天井すり抜け率（0 ≤ x ≤ 1、両端含む）
 * @param confidence - 信頼度（達成確率の閾値、0 < x < 1）。省略時は DEFAULT_CONFIDENCE
 * @returns 必要な試行回数（整数）
 * @throws {ValiError} 引数が値域外の場合
 * @throws {CalculationError} 浮動小数点境界で計算結果が非有限値になった場合
 */
export function calculateTrialCountWithPity(
  successRate: number,
  pityCount: number,
  slipRate: number,
  confidence: number = DEFAULT_CONFIDENCE,
): number {
  const validatedRate = v.parse(validProbabilityRatioSchema, successRate)
  const validatedPity = v.parse(validTrialCountSchema, pityCount)
  const validatedSlip = v.parse(validSlipRateRatioSchema, slipRate)
  const validatedConfidence = v.parse(validConfidenceSchema, confidence)

  let kNoPity: number
  try {
    kNoPity = calculateTrialCount(validatedRate, validatedConfidence)
  }
  catch (error) {
    // p 極小での浮動小数点境界。m ≤ 1-c なら k=N で P(N) ≥ c が必ず成立するため
    // （`(1-p)^(N-1) × m ≤ m ≤ 1-c` ⇒ `P(N) = 1 - (1-p)^(N-1) × m ≥ c`）、
    // m=0 を含む一般化として N を返す。それ以外は通常抽選不能のため透過させる。
    if (error instanceof CalculationError && validatedSlip <= 1 - validatedConfidence) {
      return validatedPity
    }
    throw error
  }

  if (kNoPity < validatedPity) {
    return kNoPity
  }

  // k ≥ N 領域: m=0 または m ≤ 1-c なら k=N で P(N) ≥ c が成立
  if (validatedSlip === 0 || validatedSlip <= 1 - validatedConfidence) {
    return validatedPity
  }

  // m > 1-c: (1-p)^(k-1) × m ≤ 1-c より k ≥ log((1-c)/m) / log(1-p) + 1
  const kCandidate
    = Math.ceil(
      Math.log((1 - validatedConfidence) / validatedSlip) / Math.log(1 - validatedRate),
    ) + 1
  const result = Math.max(validatedPity, kCandidate)

  if (!Number.isFinite(result)) {
    throw new CalculationError(
      '成功率が極端に小さいため試行回数を計算できません。値を見直してください。',
    )
  }
  return result
}

/**
 * calculateTrialCountWithPity の Result 型ラッパ。
 * ValiError / CalculationError を ok:false に変換、想定外エラーは再 throw する。
 */
export function tryCalculateTrialCountWithPity(
  successRate: number,
  pityCount: number,
  slipRate: number,
  confidence?: number,
): CalcResult {
  try {
    return {
      ok: true,
      value: calculateTrialCountWithPity(successRate, pityCount, slipRate, confidence),
    }
  }
  catch (error) {
    if (error instanceof v.ValiError || error instanceof CalculationError) {
      return { ok: false, message: error.message }
    }
    throw error
  }
}
