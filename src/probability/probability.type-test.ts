import * as v from 'valibot'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTargetCountSchema,
  validTrialCountSchema,
  type ConfidenceRatio,
  type ProbabilityRatio,
  type SlipRateRatio,
  type TargetCount,
  type TrialCount,
} from './probability'

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

// --- 異なる ratio 種別のブランドは相互代入できない（引数取り違え防止の検証）---

// @ts-expect-error ProbabilityRatio は ConfidenceRatio ブランドを持たないため代入不可
export const confidenceFromProbability: ConfidenceRatio = v.parse(validProbabilityRatioSchema, 0.5)
// @ts-expect-error TrialCount は TargetCount ブランドを持たないため代入不可
export const targetFromTrial: TargetCount = v.parse(validTrialCountSchema, 10)

// --- parse 経由で生成した値は対応ブランド型へ型エラーなく代入できる ---

export const parsedProbability: ProbabilityRatio = v.parse(validProbabilityRatioSchema, 0.5)
export const parsedConfidence: ConfidenceRatio = v.parse(validConfidenceSchema, 0.9)
export const parsedSlipRate: SlipRateRatio = v.parse(validSlipRateRatioSchema, 0.5)
export const parsedTrialCount: TrialCount = v.parse(validTrialCountSchema, 10)
export const parsedTargetCount: TargetCount = v.parse(validTargetCountSchema, 3)
