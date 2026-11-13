/**
 * 判別共用体の `switch` で、case の書き漏れを型エラーにするためのヘルパ。
 * `default: return assertNever(value)` と書くと、union にメンバを追加して case を書き忘れたときに気付ける。
 *
 * throw するため、例外を使わない方針の計算層（`src/probability/`）ではなく `src/lib/` に置く。
 */
export function assertNever(value: never): never {
  throw new Error(`未対応の値に到達: ${JSON.stringify(value)}`)
}
