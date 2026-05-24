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
 *   超過時に `IterationLimitExceeded` を err 返却する。
 * - 戻り値の有限性も別途検証し、非有限値なら `NonFiniteResult` を err 返却する。
 */
import { Result, err, ok } from 'neverthrow'
import { calculateTrialCount, type CalcResult } from './calculator'
import { type DomainError, parseInputOrErr } from './domain-error'
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
 * @returns ok(必要な試行回数) または err(InvalidInput / NonFiniteResult / IterationLimitExceeded)
 */
export function calculateTrialCountForMultipleSuccess(
  successRate: number,
  targetCount: number,
  confidence: number = DEFAULT_CONFIDENCE,
): CalcResult {
  return Result.combine([
    parseInputOrErr(validProbabilityRatioSchema, successRate),
    parseInputOrErr(validTargetCountSchema, targetCount),
    parseInputOrErr(validConfidenceSchema, confidence),
  ]).andThen(([validatedRate, validatedTarget, validatedConfidence]) => {
    if (validatedTarget === 1) {
      return calculateTrialCount(validatedRate, validatedConfidence)
    }

    const p = validatedRate
    const q = 1 - p
    // 期待試行回数 (targetCount/p) を基準に動的上限を設定し、UI スレッドの長時間ブロッキングを予防する。
    // 安全係数 50 は信頼度 0.99 等の極端ケースでも収束する余裕。実用域に届かない極小 p では
    // MAX_ITERATIONS で頭打ちし、最終的に IterationLimitExceeded として収束失敗を表面化する。
    const expectedTrials = validatedTarget / p
    const dynamicLimit = Math.min(MAX_ITERATIONS, Math.max(1000, Math.ceil(expectedTrials * 50)))
    // pmf[j] (0 ≤ j < targetCount) は P(X = j | k) を保持。
    // pmf[targetCount] は P(X ≥ targetCount | k) のアキュムレータ。
    // fill(0) 済みのため全要素が確実に number で、indexed access の undefined 可能性は実行時には発生しない。
    const pmf = new Array<number>(validatedTarget + 1).fill(0) as number[]
    pmf[0] = 1

    for (let k = 1; k <= dynamicLimit; k++) {
      // アキュムレータ pmf[targetCount] は前 k での値に新規流入 p·pmf[targetCount-1] を加算して更新する
      //   （アキュムレータ自身が q を乗じる挙動は流入と相殺）。
      // 続いて j = targetCount-1 から 1 まで降順で漸化式 pmf[j] = q·pmf[j] + p·pmf[j-1] を適用し、
      // 最後に pmf[0] のみ q で減衰させる。降順処理により上書き前の pmf[j-1] を参照できる。
      pmf[validatedTarget] = pmf[validatedTarget]! + p * pmf[validatedTarget - 1]!
      for (let j = validatedTarget - 1; j >= 1; j--) {
        pmf[j] = q * pmf[j]! + p * pmf[j - 1]!
      }
      pmf[0] = q * pmf[0]!

      const accumulator = pmf[validatedTarget]!
      if (accumulator >= validatedConfidence) {
        if (!Number.isFinite(accumulator)) {
          return err<number, DomainError>({
            kind: 'NonFiniteResult',
            source: 'calculateTrialCountForMultipleSuccess',
          })
        }
        return ok<number, DomainError>(k)
      }
    }

    return err<number, DomainError>({
      kind: 'IterationLimitExceeded',
      source: 'calculateTrialCountForMultipleSuccess',
    })
  })
}

/**
 * calculateTrialCountForMultipleSuccess のエイリアス（責務統合後の単純委譲）。
 */
export function tryCalculateTrialCountForMultipleSuccess(
  successRate: number,
  targetCount: number,
  confidence?: number,
): CalcResult {
  return calculateTrialCountForMultipleSuccess(successRate, targetCount, confidence)
}
