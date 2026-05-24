/**
 * 累積成功確率グラフの X 軸範囲・プロット点列を計算するユーティリティ。
 *
 * - X 軸上限: `N99 × 1.5` を切り上げ。N99 は信頼度 99% で必要な試行回数（`calculateTrialCount(p, 0.99)`）。
 *   p=0.5 で N99=7 → 上限 11 のように、信頼度 99% に届くポイントから少し余裕を持って描画範囲を決める。
 * - プロット点列: X 軸範囲の整数点を 200 点上限で等間隔サンプリング。先頭は必ず 1、末尾は upperBound。
 */
import * as v from 'valibot'
import { type Result, ok } from 'neverthrow'
import { calculateTrialCount, type CalcResult } from './calculator'
import { type DomainError, parseInputOrErr } from './domain-error'

const DEFAULT_MAX_POINTS = 200
const N99_CONFIDENCE = 0.99
const X_AXIS_EXTRA_RATIO = 1.5

/**
 * 成功率 ratio に対する X 軸上限を返す。N99 = calculateTrialCount(p, 0.99) の 1.5 倍を切り上げ。
 *
 * @param successRateRatio - 単発成功率（ratio、0 < x < 1）
 * @returns ok(X 軸上限の整数、1 以上) または err(InvalidInput / NonFiniteResult、calculateTrialCount 経由)
 */
export function computeXAxisUpperBound(successRateRatio: number): CalcResult {
  return calculateTrialCount(successRateRatio, N99_CONFIDENCE).map(n99 =>
    Math.ceil(n99 * X_AXIS_EXTRA_RATIO),
  )
}

const sampleTrialCountsInputSchema = v.object({
  upperBound: v.pipe(
    v.number('upperBound は1以上の整数を指定してください'),
    v.integer('upperBound は1以上の整数を指定してください'),
    v.minValue(1, 'upperBound は1以上の整数を指定してください'),
  ),
  maxPoints: v.pipe(
    v.number('maxPoints は2以上の整数を指定してください'),
    v.integer('maxPoints は2以上の整数を指定してください'),
    v.minValue(2, 'maxPoints は2以上の整数を指定してください'),
  ),
})

/**
 * X 軸上限までの試行回数列を最大 maxPoints 個サンプリングする。
 *
 * - upperBound <= maxPoints のときは [1, 2, ..., upperBound] の全整数を返す
 * - 超過時は等間隔サンプリング（重複除去・先頭 1 強制注入・末尾 upperBound 保証）
 *
 * @param upperBound - X 軸上限（整数、1 以上）
 * @param maxPoints - サンプル点数上限（デフォルト 200）
 * @returns ok(試行回数の整数配列、昇順・重複なし・長さ ≤ maxPoints) または err(InvalidInput)
 */
export function sampleTrialCounts(
  upperBound: number,
  maxPoints: number = DEFAULT_MAX_POINTS,
): Result<number[], DomainError> {
  return parseInputOrErr(sampleTrialCountsInputSchema, { upperBound, maxPoints }).andThen(
    (validated) => {
      const ub = validated.upperBound
      const mp = validated.maxPoints
      if (ub <= mp) {
        return ok(Array.from({ length: ub }, (_, i) => i + 1))
      }
      const set = new Set<number>([1, ub])
      // i=1..maxPoints-1 の等間隔点を追加
      for (let i = 1; i < mp; i++) {
        set.add(Math.round((i * (ub - 1)) / (mp - 1)) + 1)
      }
      return ok([...set].sort((a, b) => a - b))
    },
  )
}
