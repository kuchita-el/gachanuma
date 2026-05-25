import { err } from 'neverthrow'
import type { CalcResult } from '@/probability/calculator'

/**
 * spec 用に「InvalidInput でユーザー向け文言が指定値になる」CalcResult を生成する。
 *
 * 旧 `mockReturnValueOnce({ ok: false, message: 'テストエラー' })` 形式の代替。
 * `formatDomainError` 経由で `issues[0].message` がそのまま文言として復元される性質を利用する。
 * `DomainErrorIssue` は `{ message: string }` 縮退済みのため、valibot 型キャストは不要。
 *
 * 戻り値は常に err のため `T` はファントム。呼び出し側の期待型（`CalcResult<TrialCount>` 等
 * ブランド化された戻り値型）に追従できるよう型引数を開いておく。
 */
export function makeDomainErrResult<T = number>(message: string): CalcResult<T> {
  return err({
    kind: 'InvalidInput',
    issues: [{ message }],
  })
}
