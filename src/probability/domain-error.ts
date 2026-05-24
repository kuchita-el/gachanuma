/**
 * 計算層のドメインエラーを表す discriminated union と、ユーザー向けメッセージ生成・
 * valibot 境界正規化ヘルパを集約する。
 *
 * - `InvalidInput`: valibot の `safeParse` 失敗を正規化したエラー。`issues` は valibot 形式そのまま。
 * - `NonFiniteResult`: 浮動小数点境界（log(1-p)=0、ratio が 0 に丸まる等）で結果が有限値にならない。
 * - `IterationLimitExceeded`: 反復計算で上限まで収束しない（負の二項分布アキュムレータ）。
 *
 * 文言は source（呼び出し関数）と kind の組で完全一致するよう `formatDomainError` で復元する。
 * 旧 `CalculationError.message` のリテラル文言を維持し、画面側 spec の `findByText` を変更しないため。
 */
import * as v from 'valibot'
import { err, ok, type Result } from 'neverthrow'

export type ValiIssue = v.BaseIssue<unknown>

/**
 * NonFiniteResult を発生させ得る計算関数の識別子。
 * `formatDomainError` が文言を完全一致で復元するための文脈情報。
 */
export type NonFiniteSource
  = | 'calculateTrialCount'
    | 'calculateCumulativeSuccessProbability'
    | 'calculateTrialCountForMultipleSuccess'
    | 'calculateTrialCountWithPity'

/**
 * IterationLimitExceeded を発生させ得る計算関数の識別子（現状は負の二項分布のみ）。
 */
export type IterationLimitSource = 'calculateTrialCountForMultipleSuccess'

export type DomainError
  = | { kind: 'InvalidInput', issues: ValiIssue[] }
    | { kind: 'NonFiniteResult', source: NonFiniteSource }
    | { kind: 'IterationLimitExceeded', source: IterationLimitSource }

/**
 * DomainError をユーザー向け文言に変換する。
 *
 * - `InvalidInput`: `issues[].message` を改行結合（旧 toCalcResult の挙動を維持）。
 * - `NonFiniteResult`: source ごとに固有文言。calculateTrialCount / calculateTrialCountWithPity は
 *   旧 CalculationError 文言と同一の「成功率が極端に小さいため試行回数を計算できません。」を返す。
 * - `IterationLimitExceeded`: 反復上限超過の固定文言。
 */
export function formatDomainError(error: DomainError): string {
  switch (error.kind) {
    case 'InvalidInput':
      return error.issues.map(i => i.message).join('\n')
    case 'NonFiniteResult':
      return formatNonFiniteResult(error.source)
    case 'IterationLimitExceeded':
      return '反復上限を超えても累積確率が信頼度に達しませんでした。値を見直してください。'
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
  }
}

/**
 * valibot スキーマで入力を検証し、失敗時は `err({ kind: 'InvalidInput', issues })` を返す。
 * 計算関数の入口で `v.parse` の代替として使用し、`ValiError` の throw を境界に閉じ込める。
 */
export function parseInputOrErr<
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(schema: TSchema, input: unknown): Result<v.InferOutput<TSchema>, DomainError> {
  const result = v.safeParse(schema, input)
  if (result.success) {
    return ok(result.output as v.InferOutput<TSchema>)
  }
  return err({ kind: 'InvalidInput', issues: result.issues })
}
