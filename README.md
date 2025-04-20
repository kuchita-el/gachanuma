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
1. ブラウザでWebサーバー

## 利用ライブラリ

- [Next.js](https://nextjs.org)
- [Material UI](https://mui.com/material-ui/getting-started/)
