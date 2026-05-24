# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

確率の泥沼 (gachanuma) - A web application that calculates how many trials are needed to achieve a reliable success rate based on a single trial's success probability.

## Essential Commands

### Development
```bash
npm run dev          # Start development server with Turbopack at http://localhost:3000
npm run build        # Build static site (output to /out directory)
npm start            # Start production server
```

### Code Quality
```bash
npm run lint         # Run ESLint on the codebase
```

### Testing
```bash
npm test             # Run all tests with Vitest
```

To run a single test file:
```bash
npx vitest run <ファイルパス>
```

To run tests in watch mode:
```bash
npx vitest --watch
```

## Architecture

### Tech Stack
- **Framework**: Next.js (App Router, static export mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI primitives)
- **Form Management**: react-hook-form with Valibot for validation
- **Testing**: Vitest with React Testing Library in jsdom environment

### Project Structure
- `src/app/` - Next.js App Router のページ・レイアウト（規約ファイルのみ配置）
- `src/app/_components/` - `src/app/` 配下のページから利用される画面固有コンポーネント（Next.js 公式 private folder 規約により `_` プレフィックスでルート化を抑止）
- `src/components/` - 複数画面で再利用する汎用コンポーネント
- `src/components/ui/` - shadcn/ui で導入したコンポーネント（`src/components/` のサブカテゴリ）
- `src/lib/` - ユーティリティ（`cn` ヘルパ等）
- `src/probability/` - 確率計算ロジック・バリデーションスキーマ・ユニットテスト

### コンポーネント配置規約
- `src/app/` 直下は Next.js 規約ファイル（`page.tsx` / `layout.tsx` / `error.tsx` / `loading.tsx` / `not-found.tsx` / `route.ts` / `template.tsx` 等）のみ配置する
- 画面固有コンポーネントは `src/app/_components/` 配下に配置する（Next.js 公式 private folder 規約 `_folder/` でルート化を抑止）
- 汎用コンポーネントは `src/components/` 配下に配置する
- テストファイル（`*.spec.tsx`）は実装ファイルと同一ディレクトリに併置する

### Key Architectural Patterns

**Static Site Generation**: This project uses Next.js with `output: "export"` in `next.config.ts`, meaning it generates a static site deployed from the `/out` directory.

**Styling Architecture**: Tailwind CSS v4 を `@import "tailwindcss"` 構文（`@tailwindcss/postcss`）で導入。shadcn/ui のコンポーネントを `src/components/ui/` に配置し、`cn` ヘルパ（`clsx` + `tailwind-merge`）でクラス結合する。

**Path Aliases**: The project uses `@/*` as an alias for `src/*` configured in `tsconfig.json`.

## Development Environment

This project uses Dev Containers for development. Open the repository in VS Code with the Dev Containers extension to use the containerized environment.

## UI 検証ツール

devcontainer には [Playwright MCP](https://github.com/microsoft/playwright-mcp) サーバ（`@playwright/mcp@0.0.75`）が `.mcp.json` で定義済みであり、Claude Code から直接ブラウザ操作で UI を検証できる。`npm run dev` で開発サーバを起動した状態で、以下のような MCP ツールを使用可能。

- `browser_navigate` で `http://localhost:3000` 等の URL を開く
- `browser_snapshot` で現在ページのアクセシビリティスナップショットを取得
- `browser_click` / `browser_type` で要素操作
- `browser_take_screenshot` でスクリーンショット取得

起動コマンド（参考、通常は Claude Code が自動起動するため手動実行不要）:

```bash
npx -y @playwright/mcp@0.0.75 --isolated --headless --browser chromium
```

接続状態は `claude mcp list` で確認できる（`playwright` が `Connected` 表示）。

## Worktree

`EnterWorktree` 直後は `.claude/settings.json` の `PostToolUse` hook が worktree 内で `npm ci --no-audit --no-fund` を自動実行する。複数 worktree で `npm run dev` を並行起動する場合、ポート衝突回避のため `PORT=3001 npm run dev` 等で明示指定する。

## Language

The application UI and codebase use Japanese for user-facing text and comments. Error messages in validation schemas are in Japanese.
