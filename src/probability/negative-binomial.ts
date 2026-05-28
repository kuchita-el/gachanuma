/**
 * k 回試行のうち目的事象が targetCount 個以上発生する確率（負の二項分布相当）から、
 * 累積成功確率が信頼度以上となる最小の試行回数を求める。
 *
 * 計算方針:
 * - X ~ Binomial(k, p) として `P(X ≥ targetCount | k) = I_p(targetCount, k − targetCount + 1)`
 *   （正則化不完全ベータ）で評価する。X ≥ r の累積確率は k に対し単調非減少であり、
 *   `[targetCount, dynamicLimit]` を **二分探索**して最小の k を求める。
 * - 各 k の確率評価は `betai`（連続分数展開、`./incomplete-beta`）が k 規模に依存せず
 *   数十反復で収束するため、全体計算量は O(log dynamicLimit × βcf反復) で、実測上
 *   µs オーダーで返る（旧 PMF 漸化式の最悪 O(dynamicLimit × targetCount) を解消）。
 *
 * exact-threshold 許容誤差（Issue #58）:
 * - 二項確率がちょうど信頼度に等しい dyadic 入力（例: p=0.5, target=2, c=0.5 → P=0.5 厳密）で、
 *   不完全ベータの数値計算が信頼度を sub-ULP 単位で下回ることがあり、その場合に二分探索が
 *   +1 過剰な k を返してしまう。`EPS_THRESHOLD = 1e-12` を比較に乗せ（`P + ε ≥ c`）、
 *   数学的に正しい最小 k を返すよう吸収する。`betai` 自身の精度（~1e-14）に対し ε は十分大きく、
 *   かつ実用域で隣接 k 間の確率差 (>> 1e-12) を割り込まないため逆方向のずれは生じない。
 *
 * 早期 short-circuit:
 * - `targetCount === 1` の場合は `calculateTrialCount(rate, confidence)` を直接呼び、
 *   既存 API と完全に同一値を返す。
 *
 * 反復上限・収束不能判定:
 * - `dynamicLimit = min(MAX_ITERATIONS, max(1000, ceil(targetCount/p × 50)))` を二分探索の
 *   上限（＝収束不能判定の閾値）として使う。`P(dynamicLimit) + ε < c` の場合は実用域を
 *   超える解として `IterationLimitExceeded` を err 返却する。
 * - 戻り値の有限性は `validateOrNonFinite` で防御する。
 */
import { calculateTrialCount, type CalcResult } from './calculator'
import { domainErr, validateOrNonFinite } from './domain-error'
import { betai } from './incomplete-beta'
import {
  type ConfidenceRatio,
  type ProbabilityRatio,
  type TargetCount,
  type TrialCount,
  validTrialCountSchema,
} from './probability'

/**
 * 反復上限（二分探索の上限算出時のハードキャップ）。実用域（p ≥ 0.001、targetCount ≤ 100、
 * c ≤ 0.99）を 2 桁以上の余裕で覆える値として 1_000_000 を採用。
 */
const MAX_ITERATIONS = 1_000_000

/**
 * exact-threshold（二項確率がちょうど信頼度に等しい dyadic 入力）での sub-ULP undershoot を
 * 吸収する許容誤差。`betai` 精度（~1e-14）より十分大きく、実用域の隣接 k 間の確率差
 * （>> 1e-12）を割り込まない値として 1e-12 を採用。
 */
const EPS_THRESHOLD = 1e-12

/**
 * P(X ≥ targetCount | k) を不完全ベータで評価する。X ~ Binomial(k, p)。
 */
function cumProb(p: number, targetCount: number, k: number): number {
  return betai(targetCount, k - targetCount + 1, p)
}

/**
 * 目標成功回数 targetCount を達成する累積確率が信頼度以上となる試行回数を返す。
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
): CalcResult<TrialCount> {
  if (targetCount === 1) {
    return calculateTrialCount(successRate, confidence)
  }

  const p = successRate
  const target = targetCount
  const c = confidence

  // dynamicLimit は二分探索の上限（≒収束不能判定の閾値）。期待試行回数 (target/p) の 50 倍を基準に、
  // 下限 1000 で実用域の最小ケースを確実に覆い、MAX_ITERATIONS でハードキャップする。
  const expectedTrials = target / p
  const dynamicLimit = Math.min(MAX_ITERATIONS, Math.max(1000, Math.ceil(expectedTrials * 50)))

  // 上限到達でも収束不能なら IterationLimitExceeded を返す。
  if (cumProb(p, target, dynamicLimit) + EPS_THRESHOLD < c) {
    return domainErr({
      kind: 'IterationLimitExceeded',
      source: 'calculateTrialCountForMultipleSuccess',
    })
  }

  // [target, dynamicLimit] を二分探索: smallest k with `cumProb(k) + ε ≥ c`。
  // `lo` は ブランド型 `TargetCount` から推論されると `mid + 1` 代入で型不整合になるため
  // `number` に明示して widening する（探索インデックスはドメイン概念ではなく単なる整数）。
  let lo: number = target
  let hi: number = dynamicLimit
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (cumProb(p, target, mid) + EPS_THRESHOLD >= c) {
      hi = mid
    }
    else {
      lo = mid + 1
    }
  }

  return validateOrNonFinite(validTrialCountSchema, lo, 'calculateTrialCountForMultipleSuccess')
}
