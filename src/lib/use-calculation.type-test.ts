import type { CalculationState, UseCalculationReturn } from './use-calculation'

/**
 * `CalculationState` の排他不変条件を tsc で検証する型テスト（実行コードを持たない）。
 *
 * 各 `// @ts-expect-error` 行は「期待通り型エラーが発生していること」を観測する。行を削除すると
 * tsc が「未使用の ts-expect-error」エラーを出すため、型ガードが効いている証跡になる。ファイル名は
 * vitest のデフォルト test/spec 規約外（`.type-test.ts`）とし、テストランナーには拾わせない
 * （`probability.type-test.ts` に倣う。`npm run typecheck` / lefthook pre-commit が捕捉）。
 *
 * 観測は 2 系統に分離する:
 * - 系統A（排他不変条件の本検証）: 判別ブランチ**内**で、そのメンバに存在しないプロパティへ
 *   アクセスし型エラーを観測する（success に error なし / error・idle に result なし 等）。
 * - 系統B（narrowing 強制の補助）: 判別**前**の union で result を生参照する自明エラーを観測する。
 *
 * 各 export は no-unused-vars 回避（型レベルの検証のみが目的で実行はされない）。
 */

// --- 系統A: 判別ブランチ内で「存在しないプロパティ」を観測（排他不変の本検証）---

// TT-1: success ブランチ内に error は存在しない（success に error なし）
export function tt1(state: CalculationState<number>) {
  if (state.status === 'success') {
    // @ts-expect-error success メンバは error プロパティを持たない
    return state.error
  }
  return undefined
}

// TT-2: error ブランチ内に result は存在しない（error に result なし）
export function tt2(state: CalculationState<number>) {
  if (state.status === 'error') {
    // @ts-expect-error error メンバは result プロパティを持たない
    return state.result
  }
  return undefined
}

// TT-3: idle ブランチ内に result は存在しない
export function tt3(state: CalculationState<number>) {
  if (state.status === 'idle') {
    // @ts-expect-error idle メンバは result プロパティを持たない
    return state.result
  }
  return undefined
}

// TT-4: idle ブランチ内に error は存在しない
export function tt4(state: CalculationState<number>) {
  if (state.status === 'idle') {
    // @ts-expect-error idle メンバは error プロパティを持たない
    return state.error
  }
  return undefined
}

// --- 系統B: 判別前の union で生参照は不可（narrowing 強制の担保）---

// TT-5: 判別前の union では result が全メンバ共通でないため参照不可
export function tt5(state: CalculationState<number>) {
  // @ts-expect-error 判別前の union（idle|success|error）では result を参照できない
  return state.result
}

// --- 構築不能: 非 idle の必須プロパティ欠落・result/error 同時保持は代入不能 ---

// TT-6: 非 idle で result/error が欠落（各メンバの result/error は必須プロパティ）したオブジェクトは代入不能
// @ts-expect-error success は result 必須。欠落で代入不能（非 idle で両方欠落の排除）
export const tt6Success: CalculationState<number> = { status: 'success' }
// @ts-expect-error error は error 必須。欠落で代入不能（非 idle で両方欠落の排除）
export const tt6Error: CalculationState<number> = { status: 'error' }

// TT-7: result と error を同時に持つオブジェクトは余剰プロパティで代入不能（同時保持の排除）
// @ts-expect-error success メンバに error を併記すると余剰プロパティで代入不能
export const tt7: CalculationState<number> = { status: 'success', result: 1, error: 'x' }

// --- 正常系対照: 各正規メンバは型エラーなく構築可（過剰検出していないことの担保）---

// TT-8: idle / success / error の各正規メンバは @ts-expect-error 無しでコンパイルできる
export const tt8Idle: CalculationState<number> = { status: 'idle' }
export const tt8Success: CalculationState<number> = { status: 'success', result: 1 }
export const tt8Error: CalculationState<number> = { status: 'error', error: 'x' }

// 戻り値型 `{ ...state, run }`（spread + run）が判別共用体として narrowing でき、success
// ブランチ内で result と run を同時に参照できる（run は判別に関与しない）
export function ttReturn(calc: UseCalculationReturn<number>) {
  if (calc.status === 'success') {
    return { result: calc.result, run: calc.run }
  }
  return { run: calc.run }
}
