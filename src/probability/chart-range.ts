/**
 * 累積成功確率グラフの X 軸範囲・プロット点列を計算するユーティリティ。
 *
 * - X 軸上限: `N99 × 1.5` を切り上げ。N99 は信頼度 99% で必要な試行回数（`calculateTrialCount(p, 0.99)`）。
 *   p=0.5 で N99=7 → 上限 11 のように、信頼度 99% に届くポイントから少し余裕を持って描画範囲を決める。
 * - プロット点列: X 軸範囲の整数点を 200 点上限で等間隔サンプリング。先頭は必ず 1、末尾は upperBound。
 */
import * as v from 'valibot'
import { CalculationError, calculateTrialCount } from './calculator'
import type { CalcResult } from './calculator'

const DEFAULT_MAX_POINTS = 200
const N99_CONFIDENCE = 0.99
const X_AXIS_EXTRA_RATIO = 1.5

/**
 * 成功率 ratio に対する X 軸上限を返す。N99 = calculateTrialCount(p, 0.99) の 1.5 倍を切り上げ。
 *
 * @param successRateRatio - 単発成功率（ratio、0 < x < 1）
 * @returns X 軸上限（整数、1 以上）
 * @throws {ValiError} calculateTrialCount のバリデーション経由
 * @throws {CalculationError} p 極小の浮動小数点境界（calculateTrialCount 経由）
 */
export function computeXAxisUpperBound(successRateRatio: number): number {
  const n99 = calculateTrialCount(successRateRatio, N99_CONFIDENCE)
  return Math.ceil(n99 * X_AXIS_EXTRA_RATIO)
}

/**
 * computeXAxisUpperBound の Result 型ラッパ。
 * tryCalculateTrialCount と対称の責務分離: 画面側は try/catch + instanceof を書かずに済む。
 */
export function tryComputeXAxisUpperBound(successRateRatio: number): CalcResult {
  try {
    return { ok: true, value: computeXAxisUpperBound(successRateRatio) }
  }
  catch (error) {
    if (error instanceof v.ValiError || error instanceof CalculationError) {
      return { ok: false, message: error.message }
    }
    throw error
  }
}

/**
 * X 軸上限までの試行回数列を最大 maxPoints 個サンプリングする。
 *
 * - upperBound <= maxPoints のときは [1, 2, ..., upperBound] の全整数を返す
 * - 超過時は等間隔サンプリング（重複除去・先頭 1 強制注入・末尾 upperBound 保証）
 *
 * @param upperBound - X 軸上限（整数、1 以上）
 * @param maxPoints - サンプル点数上限（デフォルト 200）
 * @returns 試行回数の整数配列（昇順、重複なし、長さ ≤ maxPoints）
 */
export function sampleTrialCounts(
  upperBound: number,
  maxPoints: number = DEFAULT_MAX_POINTS,
): number[] {
  if (!Number.isInteger(upperBound) || upperBound < 1) {
    throw new RangeError(`upperBound は1以上の整数を指定してください: ${upperBound}`)
  }
  if (!Number.isInteger(maxPoints) || maxPoints < 2) {
    throw new RangeError(`maxPoints は2以上の整数を指定してください: ${maxPoints}`)
  }
  if (upperBound <= maxPoints) {
    return Array.from({ length: upperBound }, (_, i) => i + 1)
  }
  const set = new Set<number>([1, upperBound])
  // i=1..maxPoints-1 の等間隔点を追加
  for (let i = 1; i < maxPoints; i++) {
    set.add(Math.round((i * (upperBound - 1)) / (maxPoints - 1)) + 1)
  }
  return [...set].sort((a, b) => a - b)
}
