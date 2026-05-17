import { defineConfig } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([
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
