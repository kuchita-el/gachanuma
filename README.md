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

## 利用ライブラリ

- [Next.js](https://nextjs.org)
- [Material UI](https://mui.com/material-ui/getting-started/)

## 開発環境

このプロジェクトは、[Dev Containers](https://devcontainers.dev/)を使用して開発しています。

- VSCode
    - [Dev Containers概要](https://code.visualstudio.com/docs/devcontainers/containers)
    - [Gitリポジトリをコンテナで開く手順](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-a-git-repository-or-github-pr-in-an-isolated-container-volume)
