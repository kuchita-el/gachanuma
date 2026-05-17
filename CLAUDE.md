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
- `src/app/` - Next.js App Router のページ・レイアウト
- `src/components/ui/` - shadcn/ui で導入したコンポーネント
- `src/lib/` - ユーティリティ（`cn` ヘルパ等）
- `src/probability/` - 確率計算ロジック・バリデーションスキーマ・ユニットテスト

### Key Architectural Patterns

**Static Site Generation**: This project uses Next.js with `output: "export"` in `next.config.ts`, meaning it generates a static site deployed from the `/out` directory.

**Styling Architecture**: Tailwind CSS v4 を `@import "tailwindcss"` 構文（`@tailwindcss/postcss`）で導入。shadcn/ui のコンポーネントを `src/components/ui/` に配置し、`cn` ヘルパ（`clsx` + `tailwind-merge`）でクラス結合する。

**Path Aliases**: The project uses `@/*` as an alias for `src/*` configured in `tsconfig.json`.

## Development Environment

This project uses Dev Containers for development. Open the repository in VS Code with the Dev Containers extension to use the containerized environment.

## Language

The application UI and codebase use Japanese for user-facing text and comments. Error messages in validation schemas are in Japanese.
