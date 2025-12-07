# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

確率の泥沼 (Quagmire of Probability) - A web application that calculates how many trials are needed to achieve a reliable success rate based on a single trial's success probability.

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
npx vitest run src/probability/probability.spec.ts
```

To run tests in watch mode:
```bash
npx vitest --watch
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16.0.7 with App Router (static export mode)
- **UI Library**: Material UI v7 with Emotion for styling
- **Form Management**: react-hook-form with Zod for validation
- **Testing**: Vitest with React Testing Library in jsdom environment

### Project Structure
- `src/app/` - Next.js App Router pages and layouts
  - `page.tsx` - Main calculation page (client component)
  - `layout.tsx` - Root layout with Material UI theme provider
- `src/probability/` - Core probability calculation logic and validation schemas
  - `probability.ts` - Zod validation schemas for probability inputs
  - `probability.spec.ts` - Unit tests
- `src/theme.ts` - Material UI theme configuration

### Key Architectural Patterns

**Static Site Generation**: This project uses Next.js with `output: "export"` in [next.config.ts](next.config.ts#L4), meaning it generates a static site deployed from the `/out` directory.

**Material UI Integration**: The app uses Material UI v7 with Next.js App Router integration via `AppRouterCacheProvider` in [layout.tsx](src/app/layout.tsx#L35). All client components that use MUI hooks must be marked with `'use client'`.

**Form Validation**: Form validation uses a two-layer approach:
1. Zod schemas in `src/probability/probability.ts` define validation rules
2. react-hook-form with `@hookform/resolvers/zod` handles form state and validation in [page.tsx](src/app/page.tsx#L16)

**Path Aliases**: The project uses `@/*` as an alias for `src/*` configured in [tsconfig.json](tsconfig.json#L25-L28).

## Development Environment

This project uses Dev Containers for development. Open the repository in VS Code with the Dev Containers extension to use the containerized environment.

## Language

The application UI and codebase use Japanese for user-facing text and comments. Error messages in validation schemas are in Japanese.
