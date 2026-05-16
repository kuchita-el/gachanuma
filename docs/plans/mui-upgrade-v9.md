# 実装プラン: MUI v7→v9 アップグレード

## 概要

- **Issue**: N/A（Issue無し、ユーザー直接依頼）
- **ベースブランチ**: `main`（worktree は origin/main から作成済み、作業ブランチ `feature/update-mui`）
- **スコープ**: `@mui/material` と `@mui/material-nextjs` を 7.3.6 → 9.0.1 にアップグレード（v8 リリースは存在せず v7→v9 が直接ジャンプのメジャー1段。v8 は MUI X v9 と整合させるためスキップ）。dependency-check の結果、現コードは v9 仕様にほぼ準拠済み（既に `slotProps` を使用、Grid/Stack/Box system props 未使用）であり、ビルド・lint・型・既存ユニットテスト・目視確認の通過確認が中心。

## 判断依頼

- **[決定済み] `@mui/material-nextjs/v15-appRouter` → `/v16-appRouter` への切替を同 PR に含める**
  - ユーザー判断（2026-05-16）: 案A（同 PR）採用。アップグレードと「現行 next@16 に対する整合的なサブパス選択」を一度に完了する。
  - 影響: Task 5 は必須実施タスクとなる（条件付きではない）。

- **[決定済み] Dependabot グループ運用は現状維持**
  - ユーザー判断（2026-05-16）: 案A 採用。`.github/dependabot.yml` の `mui` グループ（`@mui/*` と `@emotion/*` をメジャー含めて束ねる構成）は既に再発防止策として機能しており、追加変更なし。

- **[前提確認] UI に対する自動テストを今回は追加しない**
  - 仮定: 既存テストは `src/probability/calculator.spec.ts`（純粋ロジック）のみ。UI コンポーネントテストは未整備。今回はアップグレード PR のスコープを「依存更新と既存テスト・ビルド・型・lint・目視動作確認」に限定し、UI 回帰テストの新規追加は行わない。
  - 異なる場合の影響: UI 自動テストを追加する判断であれば、Vitest + React Testing Library での `page.tsx` レンダリングテスト（フォーム送信、結果表示、エラー表示）を追加するタスクが必要。工数は +1〜2 時間程度。

- **[前提確認] 静的サイト出力（`next build` 時の `output: "export"`）の検証は CI ジョブ通過と `out/index.html` の目視で代替**
  - 仮定: 既存 CI に `npm run build` ジョブが存在し、`output: "export"` ありの状態で静的 export が成功すれば最低限の互換性は担保される。本番想定の静的ホスティング確認（実 HTTP 配信）は別タスク扱い。
  - 異なる場合の影響: 実 HTTP 配信での視覚回帰検証が必要なら、`out/` を `npx serve` 等で起動して動作確認するタスクを追加。

## 検証方針

### テストレベル

- **ユニット（Vitest）**: `src/probability/calculator.spec.ts` は MUI に依存しない純粋ロジックのため、回帰検出には寄与しないがリグレッション安全網として `npm test -- --run` を必ず実行し全件 pass を確認する。
- **型チェック（tsc）**: `npx tsc --noEmit` で MUI v9 の型変更（`components`/`componentsProps` 削除、`TextField` の `InputProps` 削除、Typography `paragraph` 削除等）の影響を網羅検出する。本アップグレードの主要安全網。
- **lint（ESLint）**: `npm run lint` を実行。v9 の Outline アイコン 23 個削除等の影響は import を辿るため lint/型の双方で検出可能。
- **ビルド（Next.js static export）**: `npm run build` で `output: "export"` 込みでのプロダクションビルドが通ることを確認する。Emotion SSR/プリレンダリングと `AppRouterCacheProvider` の動作を含めた統合的検証。
- **目視確認（手動 E2E 代替）**: `npm run dev` で起動した開発サーバーに対し、UI の主要操作を手動実行。MUI v9 への切替で見た目や振る舞いに退行がないことを確認する。本プロジェクトには UI 自動テストが存在しないため、ここが唯一の振る舞い回帰検出口となる。
- **UI 自動テスト不要の理由**: 既存テスト構成（Vitest + jsdom + RTL）は整っているが UI 専用テストは存在せず、本 PR は「依存更新による回帰検出」が目的で振る舞いの仕様変更は伴わない。新規 UI テストの追加は別 Issue 推奨。代替として目視確認チェックリスト（後述）を用いる。

### 検証すべき振る舞い

- **Given** v9 へアップグレード後の状態。
  **When** ユーザーが成功率 `50` を入力して「計算」を押下する。
  **Then** 試行回数 `4` が結果ボックスに表示され、`role="status"` と `aria-live="polite"` の領域に反映される。
  **検証レベル**: 目視確認（既存ユニットテストで `calculateTrialCountFromPercent(50) === 4` は自動担保済み。UI 表示部のみ目視）。

- **Given** v9 へアップグレード後の状態。
  **When** ユーザーが空欄または `0` または `100` を入力してフォーカスアウトする。
  **Then** `TextField` の `error` 状態が有効になり、ヘルパーテキストにエラーメッセージが表示される（v9 で `TextField` の `InputProps`/`inputProps`/`SelectProps` が削除されたが現コードは既に `slotProps` を使用しているため、表示崩れが起きないことを確認する）。
  **検証レベル**: 目視確認。

- **Given** v9 へアップグレード後の状態。
  **When** ページを初回ロードする。
  **Then** `AppBar` / `Toolbar` / `Container` / `CssBaseline` / `ThemeProvider` が適用され、Emotion SSR キャッシュ（`AppRouterCacheProvider`）経由でスタイルが二重適用や FOUC なく描画される。
  **検証レベル**: 目視確認（DevTools で `<style data-emotion>` が `<head>` に注入されていること、ハイドレーション時にコンソール警告が出ていないことを確認）。

- **Given** v9 へアップグレード後の `next build` 実行。
  **When** `output: "export"` 込みで静的書き出しが行われる。
  **Then** ビルドが成功し `out/index.html` が生成され、エラー・警告（特に React 19 / Emotion 11 / MUI v9 の peer 互換警告）が新規発生しない。
  **検証レベル**: 統合（CI の build ジョブで自動検出）+ 目視（ローカルでの出力確認）。

## テストケース対応表

AC は本依頼に明示されていないため、ユーザーから受領した目的（MUI を最新メジャーに追従させる）を起点に以下 AC を起こす。

**導出 AC**:
- **AC1**: `@mui/material` と `@mui/material-nextjs` の version が `9.0.1` 以上にアップデートされ、`package.json` / `package-lock.json` が整合する。
- **AC2**: `npm run lint` / `npx tsc --noEmit` / `npm test -- --run` / `npm run build` の 4 つが全て成功する。
- **AC3**: 現行 UI（`src/app/page.tsx`、`src/app/layout.tsx`、`src/theme.ts` で構成される画面）が v7 時点と同等に動作し、フォーム送信・結果表示・エラー表示・ヘッダー表示で視覚的・機能的退行がない。
- **AC4**: v9 で削除・変更された API（`components`/`componentsProps`、`GridLegacy`、Box/Stack/Typography/Grid の system props、`TextField` の `InputProps`/`inputProps`/`SelectProps`、Typography `paragraph` prop）の利用がコード内に残存しない。なお `@mui/icons-material` は本プロジェクトの依存に含まれていない（`package.json` 未記載、`src/` 内 import 0 件）ため Outline アイコン 23 個削除は対象外。
- **AC5**: 既存の Emotion ベースの SSR 連携（`AppRouterCacheProvider` 経由）が v9 でも維持され、ハイドレーション警告等が新規発生しない。

| AC# | テストケース概要 | 観点 | 採用技法 | テストレベル |
|---|---|---|---|---|
| AC1 | `package.json` の `@mui/material` と `@mui/material-nextjs` のバージョンが `^9.0.1`（または 9 系）であり、`package-lock.json` が同期している | 典型ケース | ディシジョンテーブル（パッケージ × バージョン） | 目視確認 |
| AC1 | `npm install` 実行時に peer dependency 警告・エラーが新規に出ない | 異常系 | ユースケーステスト | 目視確認 |
| AC2 | `npm run lint` が exit 0 で完了する | 典型ケース | ユースケーステスト | integration |
| AC2 | `npx tsc --noEmit` が exit 0 で完了し、型エラーがゼロである | 典型ケース | ユースケーステスト | integration |
| AC2 | `npm test -- --run` が全件 pass する（`calculator.spec.ts` の既存ケース） | 典型ケース | ユースケーステスト | unit |
| AC2 | `npm run build` が exit 0 で完了し `out/index.html` が生成される | 典型ケース | ユースケーステスト | integration |
| AC3 | 成功率 `50` 入力 → 結果 `4回` 表示 | 典型ケース | 同値分割（有効入力代表値） | 目視確認 |
| AC3 | 成功率 `0` 入力 → エラー表示（`TextField` の `error` 有効、helperText にエラー文） | 境界値 | 境界値分析 | 目視確認 |
| AC3 | 成功率 `100` 入力 → エラー表示 | 境界値 | 境界値分析 | 目視確認 |
| AC3 | 成功率 空欄でフォーカスアウト → onBlur バリデーション発火しエラー表示 | 異常系 | ユースケーステスト | 目視確認 |
| AC3 | `AppBar` のタイトル「確率の泥沼」がヘッダーに描画される | 典型ケース | ユースケーステスト | 目視確認 |
| AC3 | 結果表示ボックスの `role="status"` / `aria-live="polite"` が機能している（属性存在の DOM 確認のみ） | 典型ケース | ユースケーステスト | 目視確認 |
| AC4 | コード grep で `components=` / `componentsProps=` / `GridLegacy` / Typography `paragraph` / `InputProps=`/`inputProps=`/`SelectProps=` の使用が 0 件 | 組み合わせ | ディシジョンテーブル（削除 API × 利用箇所） | 目視確認 |
| AC4 | コード grep で Box/Stack/Typography/Grid の system props（`m=` / `p=` / `mt=` / `bgcolor=` 等の `sx` 外利用）が 0 件 | 異常系 | 同値分割 | 目視確認 |
| AC5 | DevTools で `<head>` 内に Emotion スタイルが正しく注入される | 典型ケース | ユースケーステスト | 目視確認 |
| AC5 | ブラウザコンソールでハイドレーション関連の警告・エラーが新規発生しない | 異常系 | ユースケーステスト | 目視確認 |

## 実装設計

### 変更概要

- **外部IO**: なし（API/DB/ファイル変更なし）。
- **ビジネスロジック**: なし（`src/probability/` 配下の純粋ロジックは無変更）。
- **依存パッケージ更新**: `@mui/material` と `@mui/material-nextjs` を `^9.0.1` に引き上げる。`npm install` で `@mui/utils` / `@mui/system` / `@mui/types` / `@mui/styled-engine` / `@mui/private-theming` / `@mui/core-downloads-tracker` / `react-is` / `@babel/runtime` が連動更新される（dependency-check 結果より、peer 警告なし）。
- **v9 で新規追加された optional peer**: `@mui/material@9` は `@mui/material-pigment-css ^9.0.1` を `peerDependenciesMeta.optional=true` で要求するが、本プロジェクトでは Pigment CSS を使用しないため未導入のまま警告は発生しない。`npm install` 出力解釈の前提として記録する。
- **オプション切替**: `@mui/material-nextjs/v15-appRouter` → `/v16-appRouter`（判断待ち項目の決定次第）。
- **検証**: 既存 4 つの CI ジョブ（lint / typecheck / test / build）と目視確認チェックリストで担保。

### データフロー

該当なし（既存データフロー無変更）。

### DBスキーマ変更

該当なし。

### API変更

該当なし。

### エラーハンドリング

既存のエラーハンドリング（`calculateTrialCountFromPercent` の throw → `setCalculationError`）は無変更。MUI v9 切替で例外が起きるパスはない想定。

### 過去 revert の経緯と再発防止

- 過去 PR #8（dependabot による `@mui/material-nextjs` 単体上げ）は MERGED 後 PR #18（commit `f47e5e3`）で revert された。
- 一次調査結果（`gh pr view 8` / `gh pr checks 8` / `gh pr view 18` 確認済み）:
  - PR #8 にチェックは実行されていなかった（"no checks reported"）。すなわち revert の引き金はビルド失敗ではない。
  - PR #8 の dependency-check レポート（PR コメントとして残存）には「`@mui/material-nextjs@9.0.1` の peerDependencies に `@mui/material` の指定なし」「形式上は不問」と記載されていた。技術的には install 可能だったが、`@mui/material@7` + `@mui/material-nextjs@9` というバージョン非整合状態を残すことへの保守性懸念から方針判断で revert されたと推察される。
  - PR #18 本文は `Reverts kuchita-el/quagmire-of-probability#8` のみで、明示的な理由は記録されていない。
- 再発防止策: 本 PR で `@mui/material` と `@mui/material-nextjs` を **同時に** v9.0.1 に揃える。`.github/dependabot.yml` の `mui` グループ設定（`@mui/*` と `@emotion/*` をメジャー含めて束ねる）も既に整備済みで、今後の dependabot PR でも単体上げは発生しない。

### 新規依存ライブラリ

なし（既存パッケージのメジャー更新のみ）。

### 変更対象ファイル

| ファイル/モジュール | 操作 | 変更内容 |
|---|---|---|
| `package.json` | 更新 | `@mui/material` を `^7.3.6` → `^9.0.1`、`@mui/material-nextjs` を `^7.3.6` → `^9.0.1` に変更 |
| `package-lock.json` | 更新 | `npm install` で再生成（手動編集なし） |
| `src/app/layout.tsx` | 条件付き更新 | 判断待ち項目で「同 PR で v16-appRouter に切替」を選択した場合、`@mui/material-nextjs/v15-appRouter` → `@mui/material-nextjs/v16-appRouter` に変更。それ以外無変更 |
| `src/app/page.tsx` | 無変更（要確認） | v9 で `TextField` の `slotProps` 仕様が現コードと一致しているか型チェックで確認。型エラーが出れば微修正 |
| `src/theme.ts` | 無変更（要確認） | `createTheme()` 引数なしの呼び出しは v9 でも有効。型チェックで確認 |
| `CLAUDE.md` | 任意更新 | Tech Stack の「Material UI v7」表記を「v9」に更新（プロジェクトドキュメント整合性） |
| `README.md` | 無変更 | Material UI のバージョン明記なし |

## タスク分解

### Task 1: 依存パッケージのバージョン更新と install
- **ファイル**: `package.json`, `package-lock.json`
- **内容**:
  - `package.json` の `dependencies` を編集し `@mui/material` と `@mui/material-nextjs` を `^9.0.1` に変更する。
  - `npm install` を実行して `package-lock.json` を更新する。
  - `npm ls @mui/material @mui/material-nextjs` で実体バージョンが `9.0.1` 以上であることを確認する。
- **完了条件**:
  - `package.json` の該当2行が `^9.0.1` 表記に更新されている。
  - `package-lock.json` が更新され、`@mui/material@9.x` と `@mui/material-nextjs@9.x` が解決される。
  - `npm install` で peer dependency 警告/エラーが新規発生しない（既存からの差分でゼロ）。
  - 入出力例: 変更前 `"@mui/material": "^7.3.6"` → 変更後 `"@mui/material": "^9.0.1"`。
- **依存**: なし

### Task 2: 型・lint・テスト・ビルドの通過確認
- **ファイル**: なし（コマンド実行のみ）
- **内容**: 以下を順に実行し、いずれも exit 0 で完了することを確認する。CI の `.github/workflows/ci.yml` と完全一致のコマンドを使用する（4 ジョブ: lint / typecheck / test / build に対応）。
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test -- --run`（`package.json` の `"test": "vitest"` は watch モードで起動するため `--run` を明示。本コマンド形式は CI 設定で稼働実績あり）
  - `npm run build`
- **完了条件**:
  - 4 コマンドすべて exit 0。
  - 既存ユニットテスト（`calculator.spec.ts`）の全ケースが pass する。
  - `next build` が成功し `out/index.html` が生成される。
  - 入出力例: `npm run lint` → 標準出力にエラー行なし、exit 0。`npx tsc --noEmit` → 標準出力空、exit 0。
- **依存**: Task 1

### Task 3: 削除済み API の残存チェック
- **ファイル**: なし（grep のみ）
- **内容**: 以下のパターンを `src/` 配下に対し grep し、ヒットが 0 件であることを確認する。
  - `components=` / `componentsProps=`（v9 で `slots`/`slotProps` に統一）
  - `GridLegacy`（削除済み）
  - `<Typography ` の `paragraph` prop
  - `<TextField ` の `InputProps=` / `inputProps=` / `SelectProps=`（既に `slotProps` 移行済みのはずだが念のため）
  - Box/Stack/Typography/Grid の system props（`m=` / `p=` / `mt=` / `bgcolor=` 等の `sx` 外利用）
- **完了条件**:
  - grep で 0 件、または検出された場合は `slotProps` / `sx` / `slots` 形式へ書き換える。
  - 入出力例: `grep -rn "componentsProps" src/` → 出力なし、exit 1（grep の no-match）。
- **依存**: Task 1（パッケージ更新後でも、コードの確認自体は順序中立）

### Task 4: 開発サーバー起動と目視確認
- **ファイル**: なし（手動確認のみ）
- **内容**: `npm run dev` で開発サーバーを起動し、ブラウザで `http://localhost:3000` を開いて以下を確認する。
  - ヘッダーに「確率の泥沼」と表示される
  - 成功率入力フォームと「計算」ボタンが表示される
  - `50` を入力して計算ボタンを押すと結果ボックスに「4回」と表示される
  - 入力欄を空にしてフォーカスアウトするとエラー表示される（赤い helperText）
  - `0` および `100` を入力するとエラー表示される
  - ブラウザ DevTools のコンソールにハイドレーション警告・MUI 由来のエラー/警告が新規発生していない
  - DevTools の Elements パネルで `<head>` 内に Emotion のスタイルタグが注入されている
  - 結果ボックスの背景色（`primary.light` 参照）とエラーボックスの背景色（`error.light` 参照）が v7 時点と視覚的に同等であること（v9 ではデフォルトテーマのパレット既定値や CSS variables 既定挙動が変化している可能性があるため、`createTheme()` 引数なし呼び出しの結果として描画される色を比較確認する）
- **完了条件**:
  - 上記 8 項目すべてに退行がない。スクショ等の証跡は任意。色の比較は v7 時点の見た目（事前にスクショまたは記憶で保持）と並べて差異がないことを目視判定する。
  - 入出力例: 入力 `50` → 表示 `4回`。入力 空欄でブラー → helperText に「0より大きく100未満の数値を入力してください」等のエラー文が表示。
- **依存**: Task 2

### Task 5: `/v16-appRouter` への subpath 切替
- **ファイル**: `src/app/layout.tsx`
- **内容**: 判断済み事項に基づき同 PR で実施する。
  - `import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";` を `"@mui/material-nextjs/v16-appRouter"` に変更する。
  - その後 Task 2 と Task 4 を再実行して回帰がないことを確認する。
- **完了条件**:
  - import パスが `/v16-appRouter` に更新されている。
  - 再実行した型・lint・テスト・ビルドが exit 0。
  - 再実行した目視確認で退行がない。
  - 入出力例: 変更前 `from "@mui/material-nextjs/v15-appRouter"` → 変更後 `from "@mui/material-nextjs/v16-appRouter"`。
- **依存**: Task 4

### Task 6: CLAUDE.md の Tech Stack 表記更新
- **ファイル**: `CLAUDE.md`（worktree 内のプロジェクトルート: `.claude/worktrees/update-mui/CLAUDE.md`。worktree でのコミットがマージされると main の `CLAUDE.md` に反映される）
- **内容**: 「**UI Library**: Material UI v7 with Emotion for styling」の `v7` を `v9` に更新する。「**Material UI Integration**: The app uses Material UI v7 with Next.js App Router integration via `AppRouterCacheProvider`.」の `v7` も同様に `v9` に更新する。
- **完了条件**:
  - 該当 2 箇所が `v9` 表記になっている。
  - 入出力例: 変更前 `Material UI v7 with Emotion` → 変更後 `Material UI v9 with Emotion`。
- **依存**: Task 5（または Task 4、判断結果に依存）

### Task 7: コミット作成
- **ファイル**: なし（git 操作のみ）
- **内容**:
  - `git status` で変更ファイルを確認。
  - `git add` で `package.json`、`package-lock.json`、必要に応じて `src/app/layout.tsx`、`CLAUDE.md` をステージ。
  - コミットメッセージ（軍の報告調・日本語）でコミット。`-m` を複数回指定（CLAUDE.md ルールに従い HEREDOC は使わない）。例:
    - 1行目: `MUIをv7からv9にアップグレード`
    - 2行目以降: 変更概要、判断待ち項目の決定結果、検証結果サマリ。
- **完了条件**:
  - `git log --oneline -1` で新規コミットが確認できる。
  - `git status` がクリーン。
- **依存**: Task 6

## 参照ドキュメント

- `CLAUDE.md`（プロジェクトルート） — プロジェクト概要・コマンド・アーキテクチャ。Material UI v7 → v9 への表記更新が必要。
- `.github/dependabot.yml` — `mui` グループに `@mui/*` と `@emotion/*` をまとめてメジャー含めて更新する設定済み。revert 経緯（commit `f47e5e3`）への対応として有効に機能している。
- `.github/workflows/ci.yml` — lint / typecheck / test / build の 4 ジョブ構成。本 PR の検証はこの CI で担保される。
- MUI v9 マイグレーションガイド（公式）: https://mui.com/material-ui/migration/upgrade-to-v9/ — `slots`/`slotProps` 移行、`GridLegacy` 削除、system props 削除等の v9 Breaking Changes 一覧。
- MUI Next.js 統合ガイド（公式）: https://mui.com/material-ui/integrations/nextjs/ — `AppRouterCacheProvider` の v15/v16 サブパス使い分け。
