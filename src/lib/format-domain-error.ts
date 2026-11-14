/**
 * 計算層の `DomainError` を、ユーザー向けの文言に変換する。
 * 文言は表示の関心なので、計算層（`@/probability/`）ではなくここに置く。
 */
import { type DomainError, type NonFiniteSource } from '@/probability/domain-error'
import { assertNever } from '@/lib/assert-never'

/**
 * DomainError をユーザー向けの文言に変換する。
 * `InvalidInput` は検証メッセージを改行でつなぎ、`NonFiniteResult` は発生した計算ごとに文言を変える。
 */
export function formatDomainError(error: DomainError): string {
  switch (error.kind) {
    case 'InvalidInput':
      return error.issues.map(i => i.message).join('\n')
    case 'NonFiniteResult':
      return formatNonFiniteResult(error.source)
    case 'IterationLimitExceeded':
      return '反復上限を超えても累積確率が信頼度に達しませんでした。成功率が極端に小さい可能性があります。値を見直してください。'
    default:
      return assertNever(error)
  }
}

function formatNonFiniteResult(source: NonFiniteSource): string {
  switch (source) {
    case 'calculateTrialCount':
    case 'calculateTrialCountWithPity':
      return '成功率が極端に小さいため試行回数を計算できません。値を見直してください。'
    case 'calculateCumulativeSuccessProbability':
    case 'evaluateSuccessCurve':
      return '成功率が極端に小さいため累積成功確率を計算できません。値を見直してください。'
    case 'calculateTrialCountForMultipleSuccess':
      return '計算結果が数値として表現できません。値を見直してください。'
    case 'computeXAxisUpperBound':
    case 'sampleTrialCounts':
      return 'グラフの試行回数範囲を計算できません。値を見直してください。'
    default:
      return assertNever(source)
  }
}
