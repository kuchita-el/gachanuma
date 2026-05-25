/**
 * 計算層のドメインエラーを表す discriminated union と、ユーザー向けメッセージ生成・
 * valibot 境界正規化ヘルパを集約する。
 *
 * - `InvalidInput`: valibot の `safeParse` 失敗を正規化したエラー。`issues` は `{ message }` のみ。
 * - `NonFiniteResult`: 浮動小数点境界（log(1-p)=0、ratio が 0 に丸まる等）で結果が有限値にならない。
 * - `IterationLimitExceeded`: 反復計算で上限まで収束しない（負の二項分布アキュムレータ）。
 *
 * 文言は source（呼び出し関数）と kind の組で完全一致するよう `formatDomainError` で復元する。
 * 旧 `CalculationError.message` のリテラル文言を維持し、画面側 spec の `findByText` を変更しないため。
 */
import * as v from 'valibot'
import { err, ok, type Result } from 'neverthrow'
import { assertNever } from '@/lib/assert-never'

/**
 * `InvalidInput.issues` の要素型。実利用は `message` のみのため、valibot 内部構造
 * (`v.BaseIssue<unknown>`) を露出させずに最小情報のみ保持する。これにより `parseInputOrErr`
 * 以外の場所で valibot 型に依存せず、テストヘルパでも素のオブジェクトを渡せる。
 */
export type DomainErrorIssue = { message: string }

/**
 * NonFiniteResult を発生させ得る計算関数の識別子。
 * `formatDomainError` が文言を完全一致で復元するための文脈情報。
 */
export type NonFiniteSource
  = | 'calculateTrialCount'
    | 'calculateCumulativeSuccessProbability'
    | 'calculateTrialCountForMultipleSuccess'
    | 'calculateTrialCountWithPity'
    | 'computeXAxisUpperBound'
    | 'sampleTrialCounts'

/**
 * IterationLimitExceeded を発生させ得る計算関数の識別子（現状は負の二項分布のみ）。
 */
export type IterationLimitSource = 'calculateTrialCountForMultipleSuccess'

export type DomainError
  = | { kind: 'InvalidInput', issues: DomainErrorIssue[] }
    | { kind: 'NonFiniteResult', source: NonFiniteSource }
    | { kind: 'IterationLimitExceeded', source: IterationLimitSource }

/**
 * `DomainError` の err Result を生成するヘルパ。`err({ kind: 'NonFiniteResult', ... })` の
 * 戻り型推論が `kind: string` に widening されるのを防ぐため、引数型を `DomainError` に
 * 固定して contextual typing で literal kind を解決させる。`err<T, E>()` の冗長な型引数を省略可能。
 */
export function domainErr(error: DomainError): Result<never, DomainError> {
  return err(error)
}

/**
 * DomainError をユーザー向け文言に変換する。
 *
 * - `InvalidInput`: `issues[].message` を改行結合（旧 toCalcResult の挙動を維持）。
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
      return '反復上限を超えても累積確率が信頼度に達しませんでした。値を見直してください。'
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

/**
 * valibot スキーマで入力を検証し、失敗時は `err({ kind: 'InvalidInput', issues })` を返す。
 * 計算関数の入口で `v.parse` の代替として使用し、`ValiError` の throw を境界に閉じ込める。
 * valibot の `BaseIssue<unknown>[]` は `message` のみ抽出して `DomainErrorIssue[]` に正規化する。
 */
export function parseInputOrErr<
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(schema: TSchema, input: unknown): Result<v.InferOutput<TSchema>, DomainError> {
  const result = v.safeParse(schema, input)
  if (result.success) {
    return ok(result.output)
  }
  return err({
    kind: 'InvalidInput',
    issues: result.issues.map(i => ({ message: i.message })),
  })
}

/**
 * 計算結果を出力スキーマで再検証してブランド化する。`v.parse` と異なり失敗時に throw せず
 * `NonFiniteResult` の err を返すため、計算層の throw 撲滅契約（結果は Result で表現）を保ったまま
 * 戻り値の値域を実行時にも担保できる。Result チェーン（描画中の chart 等）を貫通する throw を防ぐ。
 *
 * 入力値域違反は `parseInputOrErr`（`InvalidInput`）が担う。本関数は検証済み入力から算出した
 * 結果の不変条件違反（通常は到達不能）を Result 経路へ正規化する用途に限る。
 */
export function validateOrNonFinite<
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(schema: TSchema, value: unknown, source: NonFiniteSource): Result<v.InferOutput<TSchema>, DomainError> {
  const result = v.safeParse(schema, value)
  if (result.success) {
    return ok(result.output)
  }
  return domainErr({ kind: 'NonFiniteResult', source })
}
