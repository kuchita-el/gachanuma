/**
 * 累積成功確率グラフの X 軸範囲・プロット点列を計算するユーティリティ。
 *
 * - X 軸上限: `N99 × 1.5` を切り上げ。N99 は信頼度 99% で必要な試行回数（`calculateTrialCount(p, 0.99)`）。
 *   p=0.5 で N99=7 → 上限 11 のように、信頼度 99% に届くポイントから少し余裕を持って描画範囲を決める。
 * - プロット点列: X 軸範囲の整数点を 200 点上限で等間隔サンプリング。先頭は必ず 1、末尾は upperBound。
 */
import * as v from 'valibot'
import { Result } from 'neverthrow'
import { calculateTrialCount, type CalcResult } from './calculator'
import { type DomainError, parseInputOrErr, validateOrNonFinite } from './domain-error'
import {
  type ProbabilityRatio,
  type TrialCount,
  validConfidenceSchema,
  validTrialCountSchema,
} from './probability'

const DEFAULT_MAX_POINTS = 200
const N99_CONFIDENCE = v.parse(validConfidenceSchema, 0.99)
const X_AXIS_EXTRA_RATIO = 1.5

/**
 * 成功率 ratio に対する X 軸上限を返す。N99 = calculateTrialCount(p, 0.99) の 1.5 倍を切り上げ。
 *
 * @param successRateRatio - 単発成功率（検証済みブランド値、0 < x < 1）
 * @returns ok(X 軸上限の整数、1 以上) または err(NonFiniteResult、calculateTrialCount 経由または上限値の再検証で)
 */
export function computeXAxisUpperBound(successRateRatio: ProbabilityRatio): CalcResult<TrialCount> {
  return calculateTrialCount(successRateRatio, N99_CONFIDENCE).andThen(n99 =>
    validateOrNonFinite(
      validTrialCountSchema,
      Math.ceil(n99 * X_AXIS_EXTRA_RATIO),
      'computeXAxisUpperBound',
    ),
  )
}

// maxPoints は描画設定値のためブランド対象外（方針A）。upperBound は TrialCount で受領済みのため
// 値域 parse は不要で、ここでは maxPoints の値域のみを検証する。
const maxPointsSchema = v.pipe(
  v.number('maxPoints は2以上の整数を指定してください'),
  v.integer('maxPoints は2以上の整数を指定してください'),
  v.minValue(2, 'maxPoints は2以上の整数を指定してください'),
)

/**
 * X 軸上限までの試行回数列を最大 maxPoints 個サンプリングする。
 *
 * - upperBound <= maxPoints のときは [1, 2, ..., upperBound] の全整数を返す
 * - 超過時は等間隔サンプリング（重複除去・先頭 1 強制注入・末尾 upperBound 保証）
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
    // 各点を validateOrNonFinite でブランド化（throw せず Result へ正規化）して Result.combine で束ねる。
    // 値は常に 1 以上 upperBound 以下の整数のため失敗は到達不能だが、計算層の throw 撲滅契約に揃える。
    const brand = (n: number) =>
      validateOrNonFinite(validTrialCountSchema, n, 'sampleTrialCounts')
    if (ub <= mp) {
      return Result.combine(Array.from({ length: ub }, (_, i) => brand(i + 1)))
    }
    const set = new Set<number>([1, ub])
    // i=1..maxPoints-1 の等間隔点を追加
    for (let i = 1; i < mp; i++) {
      set.add(Math.round((i * (ub - 1)) / (mp - 1)) + 1)
    }
    return Result.combine([...set].sort((a, b) => a - b).map(brand))
  })
}
