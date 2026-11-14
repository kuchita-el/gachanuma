/** 累積成功確率グラフの X 軸の範囲と、描画する点の列を求める */
import * as v from 'valibot'
import { err, ok, Result } from 'neverthrow'
import { type DomainError, parseInputOrErr, validateOrNonFinite } from '@/probability/domain-error'
import { calculateTrialCountOnCurve, type SuccessCurve } from '@/probability/success-curve'
import {
  type TrialCount,
  validConfidenceSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

const DEFAULT_MAX_POINTS = 200
const N99_CONFIDENCE = v.parse(validConfidenceSchema, 0.99)
const X_AXIS_EXTRA_RATIO = 1.5
/** 必ず含めたい試行回数に対する余白の比率。マーカーとラベルが右端に張り付かないようにする */
const INCLUDED_TRIAL_EXTRA_RATIO = 1.2
/** X 軸の目盛り間隔の数の上限（目盛りは 0 を含めて最大この数 + 1 本） */
const MAX_TICK_INTERVALS = 5

/**
 * X 軸の上限を返す。曲線が 99% に届く試行回数の 1.5 倍（切り上げ）とし、
 * 曲線が 99% に届くところまで余裕を持って描く（例: 成功率 50% → 7回 → 上限 11）。
 * include を渡したときは、その 1.2 倍（切り上げ）以上にして、計算結果や入力した試行回数を
 * 必ず範囲に含める（Issue #8 / #17）。
 * 99% に届く回数が計算できない（例: 複数回成功で反復上限を超える）ときは、include だけで決める。
 * 結果は計算できたのにグラフだけエラーになるのを避けるため。
 *
 * @param curve - 曲線のモデル（検証済みブランド値）
 * @param include - 必ず範囲に含めたい試行回数（検証済みブランド値）
 * @returns ok(X 軸上限の整数、1 以上) または err(曲線の必要回数の計算エラー、または NonFiniteResult)
 */
export function computeXAxisUpperBound(
  curve: SuccessCurve,
  include?: TrialCount,
): Result<TrialCount, DomainError> {
  const includeBound = include === undefined ? 1 : Math.ceil(include * INCLUDED_TRIAL_EXTRA_RATIO)
  return calculateTrialCountOnCurve(curve, N99_CONFIDENCE)
    .map(n99 => Math.ceil(n99 * X_AXIS_EXTRA_RATIO))
    .orElse(error => (include === undefined ? err(error) : ok(includeBound)))
    .andThen(bound =>
      validateOrNonFinite(validTrialCountSchema, Math.max(bound, includeBound), 'computeXAxisUpperBound'),
    )
}

/**
 * 0 から始まる切りの良い目盛り（1・2・5 × 10^k 刻み）を返す（Issue #16）。
 * 末尾の目盛りは upperBound 以上で、X 軸の domain の上限に使う。
 * 刻みは、間隔の数が 5 以下になる最小のものを選ぶ（例: 689 → [0, 200, 400, 600, 800]）。
 * 試行回数は整数のため、刻みは 1 未満にしない。
 *
 * @param upperBound - X 軸上限（検証済みブランド値、整数、1 以上）
 * @returns 昇順の目盛り（先頭は 0、長さ 2 以上 6 以下）
 */
export function computeNiceTicks(upperBound: TrialCount): number[] {
  const step = findNiceStep(upperBound)
  const intervals = Math.ceil(upperBound / step)
  return Array.from({ length: intervals + 1 }, (_, i) => i * step)
}

/**
 * X 軸の範囲（domain の上限と目盛り）を返す。上限は `computeXAxisUpperBound` を
 * `computeNiceTicks` の末尾の目盛りまで広げたもので、曲線はこの上限まで描く。
 *
 * @param curve - 曲線のモデル（検証済みブランド値）
 * @param include - 必ず範囲に含めたい試行回数（検証済みブランド値）
 * @returns ok({ upperBound: domain の上限, ticks: 目盛り }) または err（`computeXAxisUpperBound` と同じ）
 */
export function computeXAxisRange(
  curve: SuccessCurve,
  include?: TrialCount,
): Result<{ upperBound: TrialCount, ticks: number[] }, DomainError> {
  return computeXAxisUpperBound(curve, include).andThen((upperBound) => {
    const ticks = computeNiceTicks(upperBound)
    return validateOrNonFinite(validTrialCountSchema, ticks.at(-1), 'computeXAxisUpperBound')
      .map(niceUpperBound => ({ upperBound: niceUpperBound, ticks }))
  })
}

function findNiceStep(upperBound: number): number {
  // 1 桁上の刻みでは必ず条件を満たすため、ループは高々 2 周で終わる
  for (let magnitude = 10 ** Math.floor(Math.log10(upperBound / MAX_TICK_INTERVALS)); ; magnitude *= 10) {
    for (const factor of [1, 2, 5]) {
      const step = Math.max(1, factor * magnitude)
      if (Math.ceil(upperBound / step) <= MAX_TICK_INTERVALS) {
        return step
      }
    }
  }
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
