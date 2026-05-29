/**
 * 計算層のドメインエラーを表す discriminated union と、ユーザー向けメッセージ生成・
 * valibot 境界正規化ヘルパを集約する。
 *
 * - `InvalidInput`: valibot の `safeParse` 失敗を正規化したエラー。`issues` は `{ message }` のみ。
 * - `NonFiniteResult`: 浮動小数点境界（log(1-p)=0、ratio が 0 に丸まる等）で結果が有限値にならない。
 * - `IterationLimitExceeded`: 反復計算で上限まで収束しない（負の二項分布アキュムレータ）。
 *
 * ユーザー向け文言への変換は表示の関心のため `@/lib/format-domain-error`（表示層）が担う。
 * 本モジュールは `DomainError` 型と、valibot 境界を Result へ正規化するヘルパに純化する。
 */
import * as v from 'valibot'
import { err, ok, type Result } from 'neverthrow'

/**
 * `InvalidInput.issues` の要素型。実利用は `message` のみのため、valibot 内部構造
 * (`v.BaseIssue<unknown>`) を露出させずに最小情報のみ保持する。これにより `parseInputOrErr`
 * 以外の場所で valibot 型に依存せず、テストヘルパでも素のオブジェクトを渡せる。
 */
export type DomainErrorIssue = { message: string }

/**
 * NonFiniteResult を発生させ得る計算関数の識別子。
 * 表示層が文言を完全一致で復元するための文脈情報。
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
