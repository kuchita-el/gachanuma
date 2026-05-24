import { defineConfig } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import stylistic from '@stylistic/eslint-plugin'
import { all as ignorePatterns } from './ignore-patterns.mjs'

export default defineConfig([
  { ignores: ignorePatterns },
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
  },
  stylistic.configs.recommended,
  {
    rules: {
      '@stylistic/indent': ['error', 2],
    },
  },
])
