# 実装プラン: Issue #47 refactor(probability): 計算ロジック層を信頼度引数・拡張可能形に整える

## 概要

- **Issue**: #47
- **ベースブランチ**: `main`
- **スコープ**: `src/probability/` 配下の計算ロジック層を、信頼度引数化・ratio 統一・逆方向計算追加・信頼度スキーマ追加によりリファクタする。UI は `page.tsx` の関数呼び出し1箇所のみ書き換え、表示・フォーム・バリデーションは不変。

## 判断依頼

- **[前提確認] `validConfidenceSchema` のエラーメッセージは「信頼度」を主語にした日本語固定文言で実装する**
  - 仮定: 既存 `validProbabilityRatioSchema` のメッセージ「成功率は0より大きい値を指定してください。」と同様の構文で「信頼度は0より大きい値を指定してください。」「信頼度は1未満の値を指定してください。」を採用する。`v.number(...)` のエラーは「数値を指定してください。」で揃える。
  - 異なる場合の影響: UI 側に信頼度入力フォームを露出させる #31 で文言が変わるなら、本 Issue では未使用のため文言調整のみで済む（計算関数側の挙動には影響しない）。

- **[前提確認] `percentToRatio` / `ratioToPercent` は純関数（バリデーションなし）として実装する**
  - 仮定: 単純な算術変換（`p / 100` / `r * 100`）のみとし、ドメイン値域チェックは呼び出し側のスキーマ（`probabilityPercentageSchema` / `validProbabilityRatioSchema`）に委ねる。型は `(n: number) => number`。
  - ユーザー承認（2026-05-19）: 必要が認められれば実装時にバリデーションを付与してよい。本 Issue の用途では呼び出し側で既に検証済み（UI フォームスキーマ → 計算関数内 ratio スキーマ）のためバリデーションなしを基本方針とするが、Task 1 実装時に呼び出し箇所の検証経路を再確認し、必要と判断した場合は `v.parse` を内部に追加する。
  - 異なる場合の影響: 内部でバリデーションを行う設計に変える場合、UI 層で `parse` 例外ハンドリングが必要となり Task 4 の page.tsx 書き換えが拡大する。

- **[前提確認] `calculateCumulativeSuccessProbability` は `successRate` を `validProbabilityRatioSchema` で、`trialCount` を「正の整数」として検証する**
  - 仮定: `trialCount` は `v.pipe(v.number(), v.integer(...), v.minValue(1, ...))` 相当のスキーマで検証し、0・負・小数を弾く。既存スキーマに `validTrialCountSchema` 等は存在しないため、`calculator.ts` 内部にローカル定義するか `probability.ts` に追加する（本プランでは `probability.ts` に `validTrialCountSchema` として追加し、将来 #32 で UI 入力としても使えるよう公開する方針）。
  - 異なる場合の影響: 「`trialCount` のバリデーションは呼び出し側責務」とするなら、テストケースの異常系が `calculator.spec.ts` から減り、#32 着手時にスキーマを追加することになる。

- **[前提確認] 信頼度引数 `confidence` の境界値は `validConfidenceSchema` で `0 < x < 1`（両端排除）とする**
  - 仮定: Issue 設計メモ「値域 0 < x < 1」に準拠し、`gt(0)` & `lt(1)` で実装する。`1` を許すと `log(1 - confidence) = log(0)` が `-Infinity` となり試行回数が無限大に発散するため、計算式の数学的整合性からも両端排除が安全。
  - 異なる場合の影響: `1.0` を許容する仕様（「100% 確実に達成」を特別扱い）に変える場合、計算関数側に `confidence === 1` の分岐処理が必要となり、戻り値の意味（`Infinity` 返却 or 例外スロー）の合意が要る。

## 検証方針

### テストレベル

- **ユニット（Vitest）**: 本リファクタの中心。`src/probability/calculator.spec.ts` に `calculateTrialCount`（信頼度引数あり/なし）と `calculateCumulativeSuccessProbability` のケースを集約。`probability.ts` のスキーマ・変換ユーティリティもユニットで検証する。
- **統合（既存 React コンポーネントテスト `src/app/page.spec.tsx`）**: `page.tsx` の呼び出し書き換えにより UI 振る舞いに退行がないことを既存 8 ケースの再実行で担保する。新規追加なし。
- **E2E（Playwright `tests/e2e/calculation.spec.ts`）**: 既存 4 ケースの再実行で担保（成功率 50/1/0/100 のシナリオ）。新規追加なし。
- **目視確認**: 本 Issue は UI 不変方針のため不要だが、`npm run dev` で軽く動作確認することは推奨（Task 8）。
- **自動テスト除外**: 削除される `calculateTrialCountFromPercent` 関連テストブロックは削除する（リファクタ AC「既存 `calculateTrialCountFromPercent` を削除する」と整合）。

### 検証すべき振る舞い

- **Given** `calculateTrialCount` を信頼度引数省略で呼び出す
  **When** 成功率 `0.5` を渡す
  **Then** 既存と完全に同じ値 `4` が返る（後方互換: 信頼度デフォルト 0.9 適用）
  **検証レベル**: ユニット

- **Given** `calculateTrialCount` に信頼度引数を明示的に渡す
  **When** 成功率 `0.5`、信頼度 `0.99` を渡す
  **Then** `n ≥ log(0.01) / log(0.5)` ≒ 6.64 を `Math.ceil` で `7` が返る
  **検証レベル**: ユニット

- **Given** `calculateCumulativeSuccessProbability` を呼ぶ
  **When** 成功率 `0.5`、試行回数 `4` を渡す
  **Then** `1 - (1 - 0.5)^4 = 0.9375` が返る（浮動小数点誤差を許容した近似比較）
  **検証レベル**: ユニット

- **Given** `calculateTrialCount` と `calculateCumulativeSuccessProbability` の往復整合性
  **When** ある成功率 `p` と信頼度 `c` に対して `n = calculateTrialCount(p, c)` を求め、続いて `calculateCumulativeSuccessProbability(p, n)` を求める
  **Then** 戻り値 ≧ `c` が成立する（試行回数を `Math.ceil` で切り上げているため、信頼度の閾値を下回らない）
  **検証レベル**: ユニット

- **Given** `validConfidenceSchema` でバリデーション
  **When** `0` / `1` / 負値 / `1` 超過の値を `v.parse` に渡す
  **Then** ValiError がスローされる
  **検証レベル**: ユニット

- **Given** `percentToRatio` / `ratioToPercent` を呼ぶ
  **When** `percentToRatio(50)` / `ratioToPercent(0.5)`
  **Then** それぞれ `0.5` / `50` が返る（浮動小数点誤差を許容）
  **検証レベル**: ユニット

- **Given** UI 上の `page.tsx` で「成功率 50%」を入力し計算ボタンを押す
  **When** 内部で `calculateTrialCount(percentToRatio(50))` が呼ばれる
  **Then** 結果領域に `4回` が表示され、既存 `page.spec.tsx` の全ケースおよび `tests/e2e/calculation.spec.ts` の全ケースが pass する
  **検証レベル**: 統合 / E2E

## テストケース対応表

| AC# | テストケース概要 | 観点 | 採用技法 | テストレベル |
|---|---|---|---|---|
| AC1 | `calculateTrialCount(0.5)`（信頼度省略）が `4` を返す（後方互換） | 典型ケース | 同値分割 | unit |
| AC1 | `calculateTrialCount(0.5, 0.9)` が `4` を返す（明示信頼度・デフォルト相当） | 典型ケース | 同値分割 | unit |
| AC1 | `calculateTrialCount(0.5, 0.99)` が信頼度上昇に応じた試行回数（`7`）を返す | 典型ケース | 同値分割 | unit |
| AC1 | `calculateTrialCount(0.5, 0.5)` が信頼度下降に応じた試行回数（`1`）を返す | 典型ケース | 同値分割 | unit |
| AC1 | `calculateTrialCount(0.5, 0)` / `calculateTrialCount(0.5, 1)` / 負値 / `1` 超過で ValiError | 境界値 | 境界値分析 | unit |
| AC1 | `calculateTrialCount(0, 0.9)` / `(1, 0.9)` / 負値 / `1` 超過で ValiError（成功率側） | 境界値 | 境界値分析 | unit |
| AC2 | `calculateTrialCountFromPercent` を import するコードが repository 内に存在しない（grep 0 件） | 異常系 | ユースケーステスト | unit |
| AC3 | `percentToRatio(50)` が `0.5`、`percentToRatio(100)` が `1`、`percentToRatio(0.5)` が `0.005` | 典型ケース | 同値分割 | unit |
| AC3 | `ratioToPercent(0.5)` が `50`、`ratioToPercent(1)` が `100`、`ratioToPercent(0)` が `0` | 典型ケース | 同値分割 | unit |
| AC3 | `ratioToPercent(percentToRatio(p))` が任意の `p` で `p` に等しい（浮動小数点許容） | 組み合わせ | 同値分割 | unit |
| AC4 | UI で成功率 `50` 入力 → 「計算」押下 → `4回` 表示（既存 `page.spec.tsx` ケース pass） | 典型ケース | ユースケーステスト | integration |
| AC4 | UI で成功率 `10` 入力 → `22回` 表示（既存ケース pass） | 典型ケース | ユースケーステスト | integration |
| AC4 | E2E で成功率 `50` / `1` 入力 → `4回` / `230回` 表示（既存 e2e ケース pass） | 典型ケース | ユースケーステスト | e2e |
| AC5 | `calculateCumulativeSuccessProbability(0.5, 4)` が `0.9375` を返す | 典型ケース | 同値分割 | unit |
| AC5 | `calculateCumulativeSuccessProbability(0.1, 22)` が `0.9` 以上を返す（`calculateTrialCount(0.1)` との往復整合） | 組み合わせ | ユースケーステスト | unit |
| AC5 | `calculateCumulativeSuccessProbability` の試行回数 `0` / 負値 / 小数 で ValiError | 異常系 | 境界値分析 | unit |
| AC5 | `calculateCumulativeSuccessProbability` の成功率 `0` / `1` / 負値 / `1` 超過 で ValiError | 異常系 | 境界値分析 | unit |
| AC5 | `calculateCumulativeSuccessProbability` の戻り値が `0 < r < 1` を満たす（有限値・型 number） | 典型ケース | ユースケーステスト | unit |
| AC6 | `v.parse(validConfidenceSchema, 0.9)` が `0.9` を返す（典型値） | 典型ケース | 同値分割 | unit |
| AC6 | `v.parse(validConfidenceSchema, 0)` / `(_, 1)` / 負値 / `1` 超過 / 非数値 で ValiError、メッセージが「信頼度」主語の日本語 | 境界値 / 異常系 | 境界値分析 | unit |
| AC7 | `npm test -- --run` が全件 pass する（追加・変更したテストを含む） | 典型ケース | ユースケーステスト | unit |
| AC7 | `npm run test:e2e` または CI の e2e ジョブが全件 pass する | 典型ケース | ユースケーステスト | e2e |
| AC8 | `page.spec.tsx` 既存 8 ケースが変更なく pass する（UI 振る舞い不変の検証） | 典型ケース | ユースケーステスト | integration |
| AC8 | `tests/e2e/calculation.spec.ts` 既存 4 ケースが変更なく pass する | 典型ケース | ユースケーステスト | e2e |
| AC8 | `page.tsx` の表示文字列（「90%の確率で成功するために必要な試行回数」「0より大きく100未満の数値を入力してください」等）が変更なし（diff 確認） | 典型ケース | ユースケーステスト | 目視確認 |

AC#は Issue 本文の受け入れ条件 8 件を順に AC1〜AC8 として対応付け:
- AC1: `calculateTrialCount` に信頼度引数を追加し省略時 0.9
- AC2: `calculateTrialCountFromPercent` を削除
- AC3: `percentToRatio` / `ratioToPercent` を `probability.ts` に追加
- AC4: `page.tsx` の呼び出しを `calculateTrialCount(percentToRatio(...))` に書き換え
- AC5: 逆方向計算関数 `calculateCumulativeSuccessProbability` を追加
- AC6: `validConfidenceSchema` を `probability.ts` に追加（値域 0 < x < 1）
- AC7: 追加・変更分のテストが `calculator.spec.ts` で全パス
- AC8: UI のロジック・表示・フォーム構造・バリデーションは変更しない

## 実装設計

### 変更概要

**外部IO**: なし（フロントエンド純粋ロジックのリファクタ）。

**ビジネスロジック**:
- 信頼度（試行集合全体で成功する確率の閾値）を計算関数の引数化（既定 0.9）。
- ratio（0..1）を計算ロジック層の標準入出力単位として統一。percent→ratio 変換は UI 層責務。
- 逆方向計算（試行回数→累積成功確率）を追加。
- 信頼度専用 Valibot スキーマを新設し、エラーメッセージ主語を「信頼度」に固定。
- 試行回数バリデーション用スキーマ（正の整数）を新設。

### データフロー

入力（UI）→ `percentToRatio(50)` → ratio `0.5` → `calculateTrialCount(0.5, /* confidence default 0.9 */)` → ratio + 検証 → 数式 `Math.ceil(log(1-c) / log(1-p))` → 整数 `4` → UI 表示。

逆方向計算: `calculateCumulativeSuccessProbability(0.5, 4)` → ratio + 試行回数検証 → 数式 `1 - (1-p)^n` → ratio `0.9375` を返す（呼び出し側で `ratioToPercent` を適用して表示）。

### DBスキーマ変更

該当なし。

### API変更

該当なし（HTTP API は存在しない）。

関数シグネチャ変更（モジュール内 public API）:

| シンボル | 操作 | 変更内容 |
|---|---|---|
| `calculateTrialCount` | 変更 | `(successRate: number) => number` → `(successRate: number, confidence?: number) => number`（既定値 `0.9`） |
| `calculateTrialCountFromPercent` | 削除 | 削除し UI 側で `percentToRatio` 経由に置換 |
| `calculateCumulativeSuccessProbability` | 新規 | `(successRate: number, trialCount: number) => number` |
| `percentToRatio` / `ratioToPercent` | 新規 | `(n: number) => number` |
| `validConfidenceSchema` | 新規 | `v.pipe(v.number(...), v.gtValue(0, ...), v.ltValue(1, ...))` |
| `validTrialCountSchema` | 新規 | `v.pipe(v.number(...), v.integer(...), v.minValue(1, ...))` |
| `ValidConfidence` 型（任意） | 新規 | `v.InferOutput<typeof validConfidenceSchema>`（後続 Issue で利用見込みなら追加） |

### エラーハンドリング

- 計算関数内部で `v.parse(スキーマ, 値)` を呼び、無効入力時は ValiError をスロー（既存方針踏襲）。
- UI 側は既存 `try/catch` をそのまま流用。`error.message` のメッセージ文字列も既存スキーマを再利用するため文言不変。

### 新規依存ライブラリ

なし。

### 変更対象ファイル

| ファイル/モジュール | 操作 | 変更内容 |
|---|---|---|
| `src/probability/probability.ts` | 修正 | `percentToRatio` / `ratioToPercent` / `validConfidenceSchema` / `validTrialCountSchema` を追加。既存スキーマは無変更 |
| `src/probability/calculator.ts` | 修正 | `calculateTrialCount` に `confidence` 引数追加、`validConfidenceSchema` で検証。`calculateTrialCountFromPercent` を削除。`calculateCumulativeSuccessProbability` を追加 |
| `src/probability/calculator.spec.ts` | 修正 | `calculateTrialCountFromPercent` の `describe` ブロック削除。信頼度引数付きケース、`calculateCumulativeSuccessProbability` ケース、スキーマ・変換ユーティリティの追加テストを追記 |
| `src/app/page.tsx` | 修正 | import を `calculateTrialCountFromPercent` から `calculateTrialCount` に、`probability.ts` から `percentToRatio` を追加 import。`onSubmit` 内呼び出しを `calculateTrialCount(percentToRatio(Number(form.successRate)))` に書き換え。UI 表示・フォーム構造は不変 |
| `src/app/page.spec.tsx` | 無変更（要確認） | UI 振る舞い不変方針のため変更しない。実行して全件 pass を確認 |
| `tests/e2e/calculation.spec.ts` | 無変更（要確認） | 同上 |

## タスク分解

### Task 1: `probability.ts` に変換ユーティリティと信頼度・試行回数スキーマを追加
- **ファイル**: `src/probability/probability.ts`
- **内容**:
  - `percentToRatio(p: number): number` を追加（戻り値 `p / 100`、バリデーションなし）
  - `ratioToPercent(r: number): number` を追加（戻り値 `r * 100`、バリデーションなし）
  - `validConfidenceSchema` を `v.pipe(v.number('数値を指定してください。'), v.gtValue(0, '信頼度は0より大きい値を指定してください。'), v.ltValue(1, '信頼度は1未満の値を指定してください。'))` で追加
  - `validTrialCountSchema` を `v.pipe(v.number('数値を指定してください。'), v.integer('試行回数は整数を指定してください。'), v.minValue(1, '試行回数は1以上を指定してください。'))` で追加
  - 必要に応じて `ValidConfidence` / `ValidTrialCount` 型 alias を追加
- **完了条件**:
  - 上記関数・スキーマが export されている
  - `npx tsc --noEmit` が exit 0（型エラーなし）
  - 入出力例: `percentToRatio(50)` → `0.5`、`ratioToPercent(0.5)` → `50`、`v.parse(validConfidenceSchema, 0.9)` → `0.9`、`v.parse(validConfidenceSchema, 1)` → throw ValiError
- **依存**: なし

### Task 2: `calculator.ts` の `calculateTrialCount` に信頼度引数を追加
- **ファイル**: `src/probability/calculator.ts`
- **内容**:
  - シグネチャを `calculateTrialCount(successRate: number, confidence: number = 0.9): number` に変更
  - 関数冒頭で `v.parse(validProbabilityRatioSchema, successRate)` と `v.parse(validConfidenceSchema, confidence)` の両方を実行
  - 計算式を `Math.ceil(Math.log(1 - confidence) / Math.log(1 - successRate))` に書き換える（既存の `-1 / Math.log10(failureRate)` は信頼度 0.9 ハードコード由来のため、信頼度一般化に伴い `log` ベースの式に統一）
  - JSDoc の `@param` に `confidence` を追記、説明文に「信頼度（達成確率の閾値、既定 0.9）」を記載
  - `import` 句に `validConfidenceSchema` を追加
- **完了条件**:
  - `calculateTrialCount(0.5)` が `4` を返す（後方互換: 信頼度デフォルト 0.9 適用）
  - `calculateTrialCount(0.5, 0.9)` が `4` を返す
  - `calculateTrialCount(0.5, 0.99)` が `7` を返す
  - `npx tsc --noEmit` が exit 0
  - 入出力例: `calculateTrialCount(0.1, 0.9)` → `22`、`calculateTrialCount(0.1)` → `22`
- **依存**: Task 1

### Task 3: `calculator.ts` に `calculateCumulativeSuccessProbability` を追加
- **ファイル**: `src/probability/calculator.ts`
- **内容**:
  - 関数シグネチャ `calculateCumulativeSuccessProbability(successRate: number, trialCount: number): number`
  - 関数冒頭で `v.parse(validProbabilityRatioSchema, successRate)` と `v.parse(validTrialCountSchema, trialCount)` を実行
  - 数式 `1 - Math.pow(1 - successRate, trialCount)` を返す
  - JSDoc で「試行回数と単発成功率から、少なくとも 1 回成功する累積確率（ratio）を返す」旨を記載
  - `import` 句に `validTrialCountSchema` を追加
- **完了条件**:
  - `calculateCumulativeSuccessProbability(0.5, 4)` が `0.9375` を返す
  - `calculateCumulativeSuccessProbability(0.1, 22)` の戻り値が `0.9` 以上
  - `calculateCumulativeSuccessProbability(0, 4)` / `(0.5, 0)` / `(0.5, 1.5)` で ValiError
  - 入出力例: `calculateCumulativeSuccessProbability(0.5, 4)` → `0.9375`、`(0.5, 1)` → `0.5`
- **依存**: Task 1

### Task 4: `page.tsx` の呼び出しを新 API に書き換え
- **ファイル**: `src/app/page.tsx`
- **内容**:
  - import 4 行目を `import { calculateTrialCount } from '@/probability/calculator'` に変更
  - import 3 行目を `import { probabilityPercentageSchema, percentToRatio } from '@/probability/probability'` に変更
  - 33 行目の `calculateTrialCountFromPercent(Number(form.successRate))` を `calculateTrialCount(percentToRatio(Number(form.successRate)))` に変更
  - 上記以外の行（JSX、State、フォーム定義、表示文言「90%の確率で成功するために必要な試行回数」、helperText 文言、`probabilityPercentageSchema`、`useId`、Controller、Button 等）は完全に不変
- **完了条件**:
  - `git diff src/app/page.tsx` で変更行が import 2 行と関数呼び出し 1 行のみ
  - `npx tsc --noEmit` が exit 0
  - `npx vitest run src/app/page.spec.tsx` で既存 8 ケース全件 pass
  - 入出力例: 変更前 `calculateTrialCountFromPercent(Number(form.successRate))` → 変更後 `calculateTrialCount(percentToRatio(Number(form.successRate)))`
- **依存**: Task 1（`percentToRatio` の追加が前提）, Task 2（`calculateTrialCount` の新シグネチャ確定が前提）

### Task 5: `calculateTrialCountFromPercent` を削除
- **ファイル**: `src/probability/calculator.ts`
- **内容**:
  - `calculateTrialCountFromPercent` 関数定義と JSDoc を削除
  - `src/` 配下の参照点を `grep -rn "calculateTrialCountFromPercent" src` で 0 件確認（テスト側の参照は Task 6 で除去するため、本 Task 完了時点で `tests` 側のスクリプトファイルにヒット 0 件、`src` 側にもヒット 0 件であることのみを確認）
- **完了条件**:
  - 関数定義が削除されている
  - `grep -rn "calculateTrialCountFromPercent" src` で出力 0 件（テストファイル `src/probability/calculator.spec.ts` のみ Task 6 まで参照を残存させる）
  - `npx tsc --noEmit` が exit 0（page.tsx の参照は Task 4 で既に除去済みのため型エラー発生せず）
  - 入出力例: `grep -rn "calculateTrialCountFromPercent" src/probability/calculator.ts` → 出力なし
- **依存**: Task 4（UI 側の参照除去後に削除しビルド断絶を回避）

### Task 6: `calculator.spec.ts` のテストケース更新
- **ファイル**: `src/probability/calculator.spec.ts`
- **内容**:
  - 既存 `describe('calculateTrialCountFromPercent', ...)` ブロックを削除
  - 既存 `describe('calculateTrialCount', ...)` に以下サブ describe を追加:
    - `describe('信頼度引数あり', ...)`: 信頼度 0.9 明示、0.99（成功率 0.5 で 7 回）、0.5（成功率 0.5 で 1 回）、デフォルトと明示の同値性
    - `describe('信頼度バリデーション', ...)`: `0` / `1` / 負値 / `1.5` で `toThrow()`
  - 新規 `describe('calculateCumulativeSuccessProbability', ...)` を追加:
    - 正常系: `(0.5, 4)` → `0.9375`、`(0.5, 1)` → `0.5`、`(0.1, 22)` → 0.9 以上
    - 異常系: 成功率 `0` / `1` / 負値、試行回数 `0` / 負値 / 小数で `toThrow()`
    - 戻り値型: number、`0 < r < 1` を満たす（端点を除外）
  - 新規 `describe('calculateTrialCount と calculateCumulativeSuccessProbability の往復整合', ...)` を追加:
    - 任意の `(p, c)` に対し `n = calculateTrialCount(p, c)` で `calculateCumulativeSuccessProbability(p, n) >= c` を満たす（代表 3 ケース程度）
  - `probability.ts` の変換ユーティリティ・スキーマ用のテストを `calculator.spec.ts` に追記（既存テスト構成に合わせ単一ファイル方針）:
    - `describe('percentToRatio', ...)` / `describe('ratioToPercent', ...)`: 代表値の変換、`ratioToPercent(percentToRatio(p)) === p`（浮動小数点許容で `toBeCloseTo`）
    - `describe('validConfidenceSchema', ...)`: 典型値の通過、境界値・異常値の ValiError、エラーメッセージが「信頼度」主語であること（`toThrow(/信頼度/)`）
- **完了条件**:
  - `npx vitest run src/probability/calculator.spec.ts` が exit 0、全ケース pass
  - `calculateTrialCountFromPercent` 関連の `describe` が残存していない（`grep -rn "calculateTrialCountFromPercent" src tests` で全件 0）
  - 入出力例: `expect(calculateTrialCount(0.5, 0.99)).toBe(7)`、`expect(calculateCumulativeSuccessProbability(0.5, 4)).toBeCloseTo(0.9375)`
- **依存**: Task 5（削除完了後に対応するテストブロックを除去する）, Task 2, Task 3

### Task 7: 統合・E2E テストを既存のまま再実行し UI 振る舞い不変を検証
- **ファイル**: なし（コマンド実行のみ）
- **内容**:
  - `npm run lint` を実行
  - `npx tsc --noEmit` を実行
  - `npm test -- --run`（または `npx vitest run`）を実行
  - `npm run test:e2e` を実行（`playwright.config.ts` の `webServer` 設定で `npm run build && npm run start:static -l 3000` が自動起動されるため単独実行で完結）
- **完了条件**:
  - 全 4 コマンドが exit 0
  - `page.spec.tsx` の 8 ケース、`tests/e2e/calculation.spec.ts` の 4 ケースが全件 pass
  - 入出力例: `npm test -- --run` → `Tests N passed (N)`、`npm run test:e2e` → `N passed`
- **依存**: Task 6

### Task 8: 開発サーバー目視確認（任意・推奨）
- **ファイル**: なし（手動確認のみ）
- **内容**:
  - `npm run dev` を起動し `http://localhost:3000` を開く
  - 成功率 `50` 入力 → 計算 → `4回` 表示を確認
  - 成功率 `0` / `100` 入力 → エラー表示を確認
  - helperText 文言「0より大きく100未満の数値を入力してください」が変わっていないことを確認
  - 結果表示文「90%の確率で成功するために必要な試行回数」が変わっていないことを確認
- **完了条件**:
  - 上記 4 項目すべて退行なし
  - 入出力例: 入力 `50` → 結果領域に `4回` と「90%の確率で成功するために必要な試行回数」が表示
- **依存**: Task 7

## 参照ドキュメント

- `CLAUDE.md` — プロジェクト概要・コマンド・アーキテクチャ。Tech Stack に Tailwind + shadcn/ui + Valibot が明記されており、エラーメッセージは日本語で書く方針。
- `docs/plans/mui-upgrade-v9.md` — 既存プラン文書の参考。テストケース対応表とタスク分解の記述スタイルを踏襲。
- `src/probability/probability.ts` — 既存 `validProbabilityRatioSchema` / `probabilityPercentageSchema` の実装（追加スキーマの命名・エラーメッセージ設計の参照元）。
- `src/probability/calculator.ts` — 既存計算ロジック（修正対象）。現在は `-1 / Math.log10(failureRate)` で 90% 信頼度をハードコード実装。
- `tests/e2e/calculation.spec.ts` — 既存 E2E（UI 振る舞い不変の検証で再利用）。
- `src/app/page.spec.tsx` — 既存統合テスト（同上）。
- 関連 Issue: #31（信頼度カスタマイズ）、#32（逆算）、#33（グラフ）、#34（天井）、#35（複数回成功）— 本リファクタの動機。
