/** 累積成功確率グラフの X 軸の範囲と、描画する点の列を求める */
import * as v from 'valibot'
import { Result } from 'neverthrow'
import { calculateTrialCount } from '@/probability/required-trials'
import { type DomainError, parseInputOrErr, validateOrNonFinite } from '@/probability/domain-error'
import {
  type ProbabilityRatio,
  type TrialCount,
  validConfidenceSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

const DEFAULT_MAX_POINTS = 200
const N99_CONFIDENCE = v.parse(validConfidenceSchema, 0.99)
const X_AXIS_EXTRA_RATIO = 1.5

/**
 * X 軸の上限を返す。信頼度 99% に必要な試行回数の 1.5 倍（切り上げ）とし、
 * 曲線が 99% に届くところまで余裕を持って描く（例: 成功率 50% → 7回 → 上限 11）。
 *
 * @param successRateRatio - 単発成功率（検証済みブランド値、0 < x < 1）
 * @returns ok(X 軸上限の整数、1 以上) または err(NonFiniteResult、calculateTrialCount 経由または上限値の再検証で)
 */
export function computeXAxisUpperBound(successRateRatio: ProbabilityRatio): Result<TrialCount, DomainError> {
  return calculateTrialCount(successRateRatio, N99_CONFIDENCE).andThen(n99 =>
    validateOrNonFinite(
      validTrialCountSchema,
      Math.ceil(n99 * X_AXIS_EXTRA_RATIO),
      'computeXAxisUpperBound',
    ),
  )
}

// maxPoints は確率・回数の意味を持たない描画の設定値なので、ブランド型にしない
const maxPointsSchema = v.pipe(
  v.number('maxPoints は2以上の整数を指定してください'),
  v.integer('maxPoints は2以上の整数を指定してください'),
  v.minValue(2, 'maxPoints は2以上の整数を指定してください'),
)

/**
 * 1 から upperBound までの試行回数を、最大 maxPoints 個まで等間隔に選ぶ。
 * 1 と upperBound は必ず含む。upperBound が maxPoints 以下なら全整数を返す。
 *
 * @param upperBound - X 軸上限（検証済みブランド値、整数、1 以上）
 * @param maxPoints - サンプル点数上限（デフォルト 200）
 * @returns ok(試行回数の整数配列、昇順・重複なし・長さ ≤ maxPoints) または err(InvalidInput / NonFiniteResult)
 */
export function sampleTrialCounts(
  upperBound: TrialCount,
  maxPoints: number = DEFAULT_MAX_POINTS,
): Result<TrialCount[], DomainError> {
  return parseInputOrErr(maxPointsSchema, maxPoints).andThen((mp) => {
    const ub = upperBound
    // 値は必ず 1 以上の整数なので失敗しないが、v.parse は throw するため使わない
    const brand = (n: number) =>
      validateOrNonFinite(validTrialCountSchema, n, 'sampleTrialCounts')
    if (ub <= mp) {
      return Result.combine(Array.from({ length: ub }, (_, i) => brand(i + 1)))
    }
    const set = new Set<number>([1, ub])
    for (let i = 1; i < mp; i++) {
      set.add(Math.round((i * (ub - 1)) / (mp - 1)) + 1)
    }
    return Result.combine([...set].sort((a, b) => a - b).map(brand))
  })
}
