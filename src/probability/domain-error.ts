/**
 * 計算層のエラー型と、valibot の検証結果を Result に変換するヘルパ。
 *
 * - `InvalidInput`: 入力がスキーマの検証を通らなかった
 * - `NonFiniteResult`: 浮動小数点の限界（log(1-p) が 0 になる、比率が 0 に丸まる等）で結果が有限値にならない
 * - `IterationLimitExceeded`: 試行回数の二分探索が上限に達しても信頼度に届かない
 *
 * 計算層では例外を投げず、失敗はすべて Result で返す。
 * ユーザー向けの文言への変換は `@/lib/format-domain-error` が行う。
 */
import * as v from 'valibot'
import { err, ok, type Result } from 'neverthrow'

/**
 * `InvalidInput.issues` の要素型。valibot の `BaseIssue` を使わないのは、
 * 使うのは `message` だけで、テストでも素のオブジェクトで作れるようにするため。
 */
export type DomainErrorIssue = { message: string }

/** NonFiniteResult を返しうる計算関数。表示層が計算ごとに文言を変えるために使う */
export type NonFiniteSource
  = | 'calculateTrialCount'
    | 'calculateCumulativeSuccessProbability'
    | 'calculateTrialCountForMultipleSuccess'
    | 'calculateTrialCountWithPity'
    | 'computeXAxisUpperBound'
    | 'sampleTrialCounts'

/** IterationLimitExceeded を返しうる計算関数 */
export type IterationLimitSource = 'calculateTrialCountForMultipleSuccess'

export type DomainError
  = | { kind: 'InvalidInput', issues: DomainErrorIssue[] }
    | { kind: 'NonFiniteResult', source: NonFiniteSource }
    | { kind: 'IterationLimitExceeded', source: IterationLimitSource }

/**
 * `DomainError` の err を作る。`err({ kind: 'NonFiniteResult', ... })` と直接書くと
 * `kind` が `string` と推論されて型が合わないため、引数の型を `DomainError` に固定する。
 */
export function domainErr(error: DomainError): Result<never, DomainError> {
  return err(error)
}

/** 入力をスキーマで検証し、失敗したら `InvalidInput` の err を返す（`v.parse` は throw するため使わない） */
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
 * 計算結果をスキーマで検証してブランド型にする。失敗したら `NonFiniteResult` の err を返す。
 * 検証済みの入力から計算した結果に使うもので、通常は失敗しない。
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
