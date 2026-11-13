import { err, type Result } from 'neverthrow'
import type { DomainError } from '@/probability/domain-error'

/**
 * spec 用に、画面に `message` がそのまま表示されるドメインエラーの Result を作る。
 * `T` は使わないが、モックする計算関数の戻り値型（`Result<TrialCount, DomainError>` 等）に合わせるために受け取る。
 */
export function makeDomainErrResult<T = number>(message: string): Result<T, DomainError> {
  return err({
    kind: 'InvalidInput',
    issues: [{ message }],
  })
}
