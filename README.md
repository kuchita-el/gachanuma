# 確率の泥沼

試行1回の成功確率をもとに、何回ぐらい試行を反復すれば確実な成功を見込めるかを計算するツールです。

## 使い方

開発サーバーで実行または静的サイトとしてホスティングすることで動作します。

### 開発サーバーで実行する

1. 依存関係をインストールする。
    ```bash
    npm install
    ```
1. 開発サーバーを起動する。
    ```bash
    npm run dev
    ```
1. ブラウザで[http://localhost:3000](http://localhost:3000)を開く。

### 静的サイトとしてホスティングする

1. 依存関係をインストールする。
    ```bash
    npm install
    ```
1. 静的サイトをビルドする。
    ```bash
    npm run build
    ```
1. Webサーバー等で`/out`ディレクトリ配下を公開する。
1. ブラウザでWebサーバーにアクセスする。

> Note: GitHub Pages へのサブパス公開時のみ `basePath: /gachanuma` が有効になります（環境変数 `GITHUB_PAGES=true` の時のみ）。ローカルビルドおよび E2E では `basePath` なしで動作します。

## デプロイ

`main` ブランチへの push（および CI 成功）をトリガに、GitHub Actions が自動で GitHub Pages へデプロイします。

- 公開 URL: [https://kuchita-el.github.io/gachanuma/](https://kuchita-el.github.io/gachanuma/)
- ワークフロー: `.github/workflows/deploy.yml`（`workflow_run` で CI 成功時に起動、`workflow_dispatch` で手動実行可）
- デプロイ時のみ環境変数 `GITHUB_PAGES=true` を渡し、`next.config.ts` の `basePath` を `/gachanuma` に切り替える

### 初回セットアップ手順（リポジトリ管理者が一度だけ実施）

1. リポジトリの **Settings → Pages** を開く。
2. **Source** を **GitHub Actions** に変更する。
3. `main` への次の push（または `workflow_dispatch` 手動実行）で `Deploy to GitHub Pages` workflow が起動し、`environment: github-pages` の URL に公開される。

## 利用ライブラリ

- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)（Radix UI primitives）

## コードフォーマット

[ESLint Stylistic](https://eslint.style/)（`@stylistic/eslint-plugin`）でフォーマットとlintを一元管理しています。フォーマッタを別ツールとして導入せず、ESLintの`--fix`機能で書き換えを行います。

- `npm run format` - 全ファイルを自動修正する
- `npm run format:check` - 違反を検出するのみ（`npm run lint`と同義）

CIの`lint`ジョブで自動チェックされるため、PR作成前にローカルで`npm run format`を実行することを推奨します。

## E2E テスト

[Playwright](https://playwright.dev/) で Chromium 上のフォーム入力 → 計算 → 結果/エラー表示の経路をエンドツーエンドで検証します。

- 初回のみブラウザバイナリを取得

    ```bash
    npx playwright install chromium
    ```
- E2E 実行

    ```bash
    npm run test:e2e
    ```
- 失敗時のレポート確認

    ```bash
    npx playwright show-report
    ```

CI 上で失敗した場合は GitHub Actions の `e2e` ジョブの artifact `playwright-report` をダウンロードしてレポートを確認できます。

## Playwright MCP（AI アシスタント用ブラウザ操作）

Claude Code 等の AI アシスタントから本アプリをブラウザ操作で検証するため、[Playwright MCP サーバ](https://github.com/microsoft/playwright-mcp)（`@playwright/mcp`）を `.mcp.json` で定義しています。devcontainer 内の Claude Code で標準利用できます。

### 有効化方法

1. devcontainer を再構築する（`postCreateCommand.sh` で Chromium バイナリが自動取得される）。
2. Claude Code を起動し、`.mcp.json` の MCP サーバ承認プロンプトに同意する。
3. 接続確認:

    ```bash
    claude mcp list
    ```

    `playwright` が `Connected` で表示されれば有効化完了。

### 基本的な利用例

`npm run dev` で開発サーバを起動した状態で、Claude Code から以下のような MCP ツールを呼び出してブラウザ操作を依頼できます。

- `browser_navigate`: 指定 URL を開く（例: `http://localhost:3000`）
- `browser_snapshot`: 現在のページのアクセシビリティスナップショット（HTML 構造を含む）を取得
- `browser_click` / `browser_type`: 要素クリック・テキスト入力
- `browser_take_screenshot`: スクリーンショットを取得

> Note: MCP サーバは `--isolated --headless` で起動するため、プロファイルは永続化されず GUI も不要です。E2E テスト（`@playwright/test`、`tests/e2e/`）とは独立に動作し、Chromium バイナリのみ共用します。

## 開発環境

このプロジェクトは、[Dev Containers](https://devcontainers.dev/)を使用して開発しています。

- VSCode
    - [Dev Containers概要](https://code.visualstudio.com/docs/devcontainers/containers)
    - [Gitリポジトリをコンテナで開く手順](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-a-git-repository-or-github-pr-in-an-isolated-container-volume)

### Git pre-commit hook

[lefthook](https://lefthook.dev/) によりコミット時にESLint（フォーマット+lint兼任）と TypeScript 型チェックを自動実行します。

`.npmrc` で `ignore-scripts=true` を設定しているため `npm install` の `prepare` ライフサイクルは自動実行されません。明示的に `npm run prepare` を実行する必要があります。

- **DevContainer 利用時**: `postCreateCommand.sh` で自動セットアップされます（追加操作不要）
- **DevContainer 外**: `npm install` 後に以下を1回実行

    ```bash
    npm run prepare
    ```

hook が失敗するとコミットが中止されます。緊急時は `LEFTHOOK=0 git commit ...` でスキップ可能です。
