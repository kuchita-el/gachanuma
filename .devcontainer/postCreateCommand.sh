#!/bin/bash
# 失敗を握り潰さない。ネットワーク処理は timeout で必ず有限時間に打ち切る
# （ハングすると VS Code の「開発コンテナーの構成」通知が永久に消えなくなる）。
set -euo pipefail

# Claude Code CLI。公式インストーラを使う。
# devcontainer feature（ghcr.io/anthropics/devcontainer-features/claude-code）は
# npm -g / root 所有でインストールするため CLI の自己更新と噛み合わず、採用しない。
timeout 300 bash -c 'curl -fsSL https://claude.ai/install.sh | bash'

npm install
npm run prepare

# Playwright のシステム依存ライブラリ。root 権限が必要で、
# ブラウザのリビジョンには依存しないためここで導入する。
# --foreground は必須。付けないと timeout が専用プロセスグループを作り、
# sudo（use_pty）がそれを検知して apt-get を pty のバックグラウンドグループで走らせる。
# apt-get は進捗表示の後始末で tcsetattr() を呼ぶため SIGTTOU で停止し、
# 停止中は SIGTERM を処理しないのでタイムアウト時間を丸ごと空費する。
timeout --foreground 600 npx playwright install --with-deps chromium

# Playwright MCP 用ブラウザ。プラグイン（playwright@claude-plugins-official）が
# @playwright/mcp@latest で起動するため、バージョンを固定せず latest に揃える
# （固定すると playwright-core のリビジョンがずれ、実行時に使われないブラウザを掴む）。
# 事前取得は初回操作を速くするだけの最適化なので、失敗してもセットアップは継続する。
if ! timeout 600 npx -y @playwright/mcp@latest install-browser chromium; then
	echo "warn: Playwright MCP 用ブラウザの事前取得に失敗しました。初回のブラウザ操作時に自動取得されます。" >&2
fi
