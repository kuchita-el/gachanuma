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
 * - p 極小で calculateTrialCount が `NonFiniteResult` を返す境界では、m=0 なら天井で確定するため N を返す。
 *   一般化して m ≤ 1-c の場合も k=N で P(N) ≥ c が成立するため N を返す。m > 1-c の場合は通常抽選が
 *   無効化されるほどの極小 p なので NonFiniteResult を透過させる。InvalidInput や IterationLimitExceeded
 *   は救済対象外（透過）。
 */
import { err, ok, Result, type Result as ResultType } from 'neverthrow'
import { calculateTrialCount, type CalcResult } from './calculator'
import { type DomainError, parseInputOrErr } from './domain-error'
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
 * @returns ok(必要な試行回数) または err(InvalidInput / NonFiniteResult)
 */
export function calculateTrialCountWithPity(
  successRate: number,
  pityCount: number,
  slipRate: number,
  confidence: number = DEFAULT_CONFIDENCE,
): CalcResult {
  return Result.combine([
    parseInputOrErr(validProbabilityRatioSchema, successRate),
    parseInputOrErr(validTrialCountSchema, pityCount),
    parseInputOrErr(validSlipRateRatioSchema, slipRate),
    parseInputOrErr(validConfidenceSchema, confidence),
  ]).andThen(([validatedRate, validatedPity, validatedSlip, validatedConfidence]) => {
    return calculateTrialCount(validatedRate, validatedConfidence)
      .orElse((error) => {
        // 救済路: NonFiniteResult のみ、かつ m ≤ 1-c のとき P(N) ≥ c が必ず成立するため N を返す。
        // （`(1-p)^(N-1) × m ≤ m ≤ 1-c` ⇒ `P(N) = 1 - (1-p)^(N-1) × m ≥ c`）
        // m=0 を含む一般化として N を返す。InvalidInput は救済対象外（このパスでは発生しないが、
        // 将来の DomainError 拡張に備えて kind で明示判別）。
        if (error.kind === 'NonFiniteResult' && validatedSlip <= 1 - validatedConfidence) {
          return ok<number, DomainError>(validatedPity)
        }
        return err<number, DomainError>(error)
      })
      .andThen<number, DomainError>((kNoPity): ResultType<number, DomainError> => {
        if (kNoPity < validatedPity) {
          return ok(kNoPity)
        }

        // k ≥ N 領域: m=0 または m ≤ 1-c なら k=N で P(N) ≥ c が成立
        if (validatedSlip === 0 || validatedSlip <= 1 - validatedConfidence) {
          return ok(validatedPity)
        }

        // m > 1-c: (1-p)^(k-1) × m ≤ 1-c より k ≥ log((1-c)/m) / log(1-p) + 1
        const kCandidate
          = Math.ceil(
            Math.log((1 - validatedConfidence) / validatedSlip) / Math.log(1 - validatedRate),
          ) + 1
        const result = Math.max(validatedPity, kCandidate)

        if (!Number.isFinite(result)) {
          return err({ kind: 'NonFiniteResult', source: 'calculateTrialCountWithPity' })
        }
        return ok(result)
      })
  })
}

/**
 * calculateTrialCountWithPity のエイリアス（責務統合後の単純委譲）。
 */
export function tryCalculateTrialCountWithPity(
  successRate: number,
  pityCount: number,
  slipRate: number,
  confidence?: number,
): CalcResult {
  return calculateTrialCountWithPity(successRate, pityCount, slipRate, confidence)
}
