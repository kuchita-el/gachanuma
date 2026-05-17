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
1. ブラウザで[http://localhost:3000/gachanuma](http://localhost:3000/gachanuma)を開く（`basePath` 設定により末尾の `/gachanuma` 付きでアクセス）。

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
1. ブラウザでWebサーバーにアクセスする（`basePath` 設定により `http://<host>/gachanuma/` 配下で公開する想定）。

## デプロイ

`main` ブランチへの push（および CI 成功）をトリガに、GitHub Actions が自動で GitHub Pages へデプロイします。

- 公開 URL: [https://kuchita-el.github.io/gachanuma/](https://kuchita-el.github.io/gachanuma/)
- ワークフロー: `.github/workflows/deploy.yml`（`workflow_run` で CI 成功時に起動、`workflow_dispatch` で手動実行可）

### 初回セットアップ手順（リポジトリ管理者が一度だけ実施）

1. リポジトリの **Settings → Pages** を開く。
2. **Source** を **GitHub Actions** に変更する。
3. `main` への次の push（または `workflow_dispatch` 手動実行）で `Deploy to GitHub Pages` workflow が起動し、`environment: github-pages` の URL に公開される。

## 利用ライブラリ

- [Next.js](https://nextjs.org)
- [Material UI](https://mui.com/material-ui/getting-started/)

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
