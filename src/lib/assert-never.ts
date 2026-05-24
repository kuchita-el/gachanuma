/**
 * Exhaustiveness check helper for discriminated unions.
 *
 * `switch` の `default` 句に `return assertNever(value)` と書くことで、
 * `value` が `never` 型 (= 全 case を網羅した) でない場合に TypeScript の型エラーで気付ける。
 * 新たな union メンバを追加して case 漏れすると、`assertNever` 呼出が `never` 制約を満たさず
 * 型エラーになる。
 *
 * 計算層 (`src/probability/`) は throw 撲滅対象のため、このヘルパは `src/lib/` に配置している。
 */
export function assertNever(value: never): never {
  throw new Error(`未対応の値に到達: ${JSON.stringify(value)}`)
}
