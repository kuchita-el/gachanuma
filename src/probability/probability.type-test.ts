import * as v from 'valibot'
import {
  validConfidenceSchema,
  validCumulativeSuccessRatioSchema,
  validPityCountSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTargetCountSchema,
  validTrialCountSchema,
  type ConfidenceRatio,
  type CumulativeSuccessRatio,
  type PityCount,
  type ProbabilityRatio,
  type SlipRateRatio,
  type TargetCount,
  type TrialCount,
} from './probability'
import { calculateCumulativeSuccessProbability, calculateTrialCount } from './calculator'
import { calculateTrialCountWithPity } from './pity'
import { calculateTrialCountForMultipleSuccess } from './negative-binomial'

/**
 * ブランド型の nominal 性を tsc で検証する型テスト（実行コードを持たない）。
 *
 * 各 `// @ts-expect-error` 行は「期待通り型エラーが発生していること」を観測する。
 * 行を削除すると tsc が「未使用の ts-expect-error」エラーを出すため、型ガードが効いている
 * 証跡になる。ファイル名は vitest のデフォルト test/spec 規約外とし、テストランナーには拾わせない。
 *
 * 各 const は export して no-unused-vars を回避する（型レベルの検証のみが目的で実行はされない）。
 */

// --- raw number リテラルはブランド型変数へ代入できない（nominal 化の中核検証）---

// @ts-expect-error 0.5 は ProbabilityRatio ブランドを持たない plain number のため代入不可
export const rawProbability: ProbabilityRatio = 0.5
// @ts-expect-error 0.9 は ConfidenceRatio ブランドを持たない plain number のため代入不可
export const rawConfidence: ConfidenceRatio = 0.9
// @ts-expect-error 0.5 は SlipRateRatio ブランドを持たない plain number のため代入不可
export const rawSlipRate: SlipRateRatio = 0.5
// @ts-expect-error 10 は TrialCount ブランドを持たない plain number のため代入不可
export const rawTrialCount: TrialCount = 10
// @ts-expect-error 3 は TargetCount ブランドを持たない plain number のため代入不可
export const rawTargetCount: TargetCount = 3
// @ts-expect-error 100 は PityCount ブランドを持たない plain number のため代入不可
export const rawPityCount: PityCount = 100
// @ts-expect-error 0.5 は CumulativeSuccessRatio ブランドを持たない plain number のため代入不可
export const rawCumulativeSuccessRatio: CumulativeSuccessRatio = 0.5

// --- 異なる ratio 種別のブランドは相互代入できない（引数取り違え防止の検証）---

// @ts-expect-error ProbabilityRatio は ConfidenceRatio ブランドを持たないため代入不可
export const confidenceFromProbability: ConfidenceRatio = v.parse(validProbabilityRatioSchema, 0.5)
// @ts-expect-error TrialCount は TargetCount ブランドを持たないため代入不可
export const targetFromTrial: TargetCount = v.parse(validTrialCountSchema, 10)

// --- 同値域・別概念の count ブランドは相互代入できない（TrialCount↔PityCount swap 防止）---

// @ts-expect-error TrialCount は PityCount ブランドを持たないため代入不可
export const pityFromTrial: PityCount = v.parse(validTrialCountSchema, 100)
// @ts-expect-error PityCount は TrialCount ブランドを持たないため代入不可
export const trialFromPity: TrialCount = v.parse(validPityCountSchema, 100)

// --- parse 経由で生成した値は対応ブランド型へ型エラーなく代入できる ---

export const parsedProbability: ProbabilityRatio = v.parse(validProbabilityRatioSchema, 0.5)
export const parsedConfidence: ConfidenceRatio = v.parse(validConfidenceSchema, 0.9)
export const parsedSlipRate: SlipRateRatio = v.parse(validSlipRateRatioSchema, 0.5)
export const parsedTrialCount: TrialCount = v.parse(validTrialCountSchema, 10)
export const parsedTargetCount: TargetCount = v.parse(validTargetCountSchema, 3)
export const parsedPityCount: PityCount = v.parse(validPityCountSchema, 100)
export const parsedCumulativeSuccessRatio: CumulativeSuccessRatio
  = v.parse(validCumulativeSuccessRatioSchema, 0.5)

// --- 計算層シグネチャの swap / raw number 防止（AC4: 本 Issue の中核検証）---

const tProb = v.parse(validProbabilityRatioSchema, 0.5)
const tConf = v.parse(validConfidenceSchema, 0.9)
const tSlip = v.parse(validSlipRateRatioSchema, 0.5)
const tTrial = v.parse(validTrialCountSchema, 10)
const tTarget = v.parse(validTargetCountSchema, 3)
const tPity = v.parse(validPityCountSchema, 100)

// raw number を計算層引数へ渡すと代入不可
// @ts-expect-error 0.5 は ProbabilityRatio ブランドなし
export const rawArgRate = calculateTrialCount(0.5, tConf)
// @ts-expect-error 0.9 は ConfidenceRatio ブランドなし
export const rawArgConfidence = calculateTrialCount(tProb, 0.9)
// @ts-expect-error 10 は TrialCount ブランドなし
export const rawArgTrialCount = calculateCumulativeSuccessProbability(tProb, 10)

// 異種 ratio swap（ProbabilityRatio↔ConfidenceRatio）
// @ts-expect-error ConfidenceRatio を successRate 位置へ渡すと型エラー
export const ratioSwap = calculateTrialCount(tConf, tConf)

// 異種 count swap（TrialCount↔PityCount↔TargetCount）
// @ts-expect-error TrialCount を pityCount 引数へ渡すと型エラー
export const pityArgSwap = calculateTrialCountWithPity(tProb, tTrial, tSlip, tConf)
// @ts-expect-error PityCount を trialCount 引数へ渡すと型エラー
export const trialArgSwap = calculateCumulativeSuccessProbability(tProb, tPity)
// @ts-expect-error TrialCount を targetCount 引数へ渡すと型エラー
export const targetArgSwap = calculateTrialCountForMultipleSuccess(tProb, tTrial, tConf)
// @ts-expect-error TargetCount を trialCount 引数へ渡すと型エラー（TargetCount↔TrialCount 逆方向）
export const trialFromTargetArg = calculateCumulativeSuccessProbability(tProb, tTarget)

// --- 戻り値ブランド観測（AC5）---

// 試行回数系戻り値は TrialCount。number へは代入可（number 互換）
export const trialResultAsNumber: number = calculateTrialCount(tProb, tConf)._unsafeUnwrap()
// @ts-expect-error TrialCount 戻り値は別概念 PityCount へ代入不可
export const trialResultAsPity: PityCount = calculateTrialCount(tProb, tConf)._unsafeUnwrap()
// @ts-expect-error CumulativeSuccessRatio 戻り値は ProbabilityRatio へ代入不可
export const cumulativeResultAsProb: ProbabilityRatio
  = calculateCumulativeSuccessProbability(tProb, tTrial)._unsafeUnwrap()
