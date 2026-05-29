/**
 * 計算層の `DomainError` をユーザー向け表示文言へ変換する（表示の関心）。
 *
 * 文言は source（呼び出し関数）と kind の組で完全一致するよう復元する。
 * 旧 `CalculationError.message` のリテラル文言を維持し、画面側 spec の `findByText` を変更しないため。
 * `DomainError` 型・`NonFiniteSource` 型は計算層の `@/probability/domain-error` から import する。
 */
import { type DomainError, type NonFiniteSource } from '@/probability/domain-error'
import { assertNever } from '@/lib/assert-never'

/**
 * DomainError をユーザー向け文言に変換する。
 *
 * - `InvalidInput`: `issues[].message` を改行結合（旧変換ヘルパの挙動を維持）。
 * - `NonFiniteResult`: source ごとに固有文言。calculateTrialCount / calculateTrialCountWithPity は
 *   旧 CalculationError 文言と同一の「成功率が極端に小さいため試行回数を計算できません。」を返す。
 * - `IterationLimitExceeded`: 反復上限超過の固定文言。
 *
 * 新 `kind` 追加時は `default: assertNever(error)` が型エラーで検出する。
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
