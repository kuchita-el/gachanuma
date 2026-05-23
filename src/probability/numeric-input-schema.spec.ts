import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { numericInputSchema } from './probability'

describe('numericInputSchema', () => {
  it('文字列 "50" を渡すと数値 50 に変換される', () => {
    expect(v.parse(numericInputSchema, '50')).toBe(50)
  })

  it('数値 50 を渡すとそのまま 50 を返す', () => {
    expect(v.parse(numericInputSchema, 50)).toBe(50)
  })

  it('NaN になる文字列 "abc" を渡すと「数値を指定してください。」のエラーになる', () => {
    expect(() => v.parse(numericInputSchema, 'abc')).toThrow(/数値を指定してください。/)
  })

  it('小数文字列 "3.14" を渡すと数値 3.14 に変換される', () => {
    expect(v.parse(numericInputSchema, '3.14')).toBe(3.14)
  })
})
