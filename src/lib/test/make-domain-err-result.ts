import { err } from 'neverthrow'
import type { CalcResult } from '@/probability/calculator'

/**
 * spec 用に「InvalidInput でユーザー向け文言が指定値になる」CalcResult を生成する。
 *
 * 旧 `mockReturnValueOnce({ ok: false, message: 'テストエラー' })` 形式の代替。
 * `formatDomainError` 経由で `issues[0].message` がそのまま文言として復元される性質を利用する。
 * `DomainErrorIssue` は `{ message: string }` 縮退済みのため、valibot 型キャストは不要。
 */
export function makeDomainErrResult(message: string): CalcResult {
  return err({
    kind: 'InvalidInput',
    issues: [{ message }],
  })
}
