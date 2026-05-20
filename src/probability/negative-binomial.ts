/**
 * k 回試行のうち目的事象が targetCount 個以上発生する確率（負の二項分布相当）から、
 * 累積成功確率が信頼度以上となる最小の試行回数を求める。
 *
 * 計算方針:
 * - X ~ Binomial(k, p) として `P(X ≥ targetCount | k) = Σ_{j=targetCount..k} C(k,j)·p^j·(1-p)^(k-j)` を
 *   評価し、最小の k で `P ≥ confidence` となる k を返す。
 * - 直接二項計算は overflow / 数値精度の問題があるため、PMF 漸化式を使ったアキュムレータ方式を採用:
 *     `P(X=j|k) = P(X=j|k-1)·(1-p) + P(X=j-1|k-1)·p`
 *   `pmf[targetCount]` を「X ≥ targetCount」の累積確率として吸収項化し、毎反復で更新する。
 *
 * 早期 short-circuit:
 * - `targetCount === 1` の場合は `calculateTrialCount(rate, confidence)` を直接呼び、既存 API と
 *   完全に同一値を返す（受け入れ条件「targetCount=1 で `calculateTrialCount` と同一値」の保証）。
 *
 * 浮動小数点境界・無限ループ防御:
 * - `targetCount >= 2` で `p` が極小だと `pmf[0]` が減少せず累積が進まないため、`MAX_ITERATIONS`
 *   超過時に `CalculationError` を投げる。
 * - 戻り値の有限性も別途検証する。
 */
import * as v from 'valibot'
import { CalculationError, calculateTrialCount } from './calculator'
import type { CalcResult } from './calculator'
import {
  DEFAULT_CONFIDENCE,
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTargetCountSchema,
} from './probability'

/**
 * 累積成功確率が信頼度以上となるまでの反復上限。実用域（p ≥ 0.001、targetCount ≤ 100、c ≤ 0.99）を
 * 2 桁以上の余裕で覆える値として 1_000_000 を採用。これを超える場合は計算不能とみなす。
 */
const MAX_ITERATIONS = 1_000_000

/**
 * 目標成功回数 targetCount を達成する累積確率が信頼度以上となる試行回数を返す。
 *
 * @param successRate - 単発成功率（0 < x < 1）
 * @param targetCount - 目標成功回数（1〜100 の整数）
 * @param confidence - 信頼度（達成確率の閾値、0 < x < 1）。省略時は DEFAULT_CONFIDENCE
 * @returns 必要な試行回数（整数）
 * @throws {ValiError} 引数が値域外の場合
 * @throws {CalculationError} 反復上限超過または浮動小数点境界で計算不能の場合
 */
export function calculateTrialCountForMultipleSuccess(
  successRate: number,
  targetCount: number,
  confidence: number = DEFAULT_CONFIDENCE,
): number {
  const validatedRate = v.parse(validProbabilityRatioSchema, successRate)
  const validatedTarget = v.parse(validTargetCountSchema, targetCount)
  const validatedConfidence = v.parse(validConfidenceSchema, confidence)

  if (validatedTarget === 1) {
    return calculateTrialCount(validatedRate, validatedConfidence)
  }

  const p = validatedRate
  const q = 1 - p
  // pmf[j] (0 ≤ j < targetCount) は P(X = j | k) を保持。
  // pmf[targetCount] は P(X ≥ targetCount | k) のアキュムレータ。
  // fill(0) 済みのため全要素が確実に number で、indexed access の undefined 可能性は実行時には発生しない。
  const pmf = new Array<number>(validatedTarget + 1).fill(0) as number[]
  pmf[0] = 1

  for (let k = 1; k <= MAX_ITERATIONS; k++) {
    // アキュムレータ pmf[targetCount] は (1-p)·pmf[targetCount] + p·pmf[targetCount-1] + p·pmf[targetCount]
    //   = pmf[targetCount] + p·pmf[targetCount-1]
    // という挙動になる。降順 j で通常の漸化式を適用しつつ、最後に補正する。
    pmf[validatedTarget] = pmf[validatedTarget]! + p * pmf[validatedTarget - 1]!
    for (let j = validatedTarget - 1; j >= 1; j--) {
      pmf[j] = q * pmf[j]! + p * pmf[j - 1]!
    }
    pmf[0] = q * pmf[0]!

    const accumulator = pmf[validatedTarget]!
    if (accumulator >= validatedConfidence) {
      if (!Number.isFinite(accumulator)) {
        throw new CalculationError(
          '計算結果が数値として表現できません。値を見直してください。',
        )
      }
      return k
    }
  }

  throw new CalculationError(
    '反復上限を超えても累積確率が信頼度に達しませんでした。値を見直してください。',
  )
}

/**
 * calculateTrialCountForMultipleSuccess の Result 型ラッパ。
 * ValiError / CalculationError を ok:false に変換し、想定外エラーは再 throw する。
 */
export function tryCalculateTrialCountForMultipleSuccess(
  successRate: number,
  targetCount: number,
  confidence?: number,
): CalcResult {
  try {
    return {
      ok: true,
      value: calculateTrialCountForMultipleSuccess(successRate, targetCount, confidence),
    }
  }
  catch (error) {
    if (error instanceof v.ValiError || error instanceof CalculationError) {
      return { ok: false, message: error.message }
    }
    throw error
  }
}
