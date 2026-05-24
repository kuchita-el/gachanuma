import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  validProbabilityPercentageSchema,
  validConfidencePercentageSchema,
  validSlipRatePercentageSchema,
  probabilityPercentageSchema,
  confidencePercentageSchema,
  targetCountInputSchema,
  trialCountInputSchema,
} from './form-schemas'

// Percentage 系「数値→valid」スキーマの単体テスト。
// valid 単独は数値型のみ受理する（文字列→数値変換は numericInputSchema の責務）。
describe('validProbabilityPercentageSchema', () => {
  it('典型値 50 はそのまま 50 を返す', () => {
    expect(v.parse(validProbabilityPercentageSchema, 50)).toBe(50)
  })

  it('境界値 0 は両端排除で throw', () => {
    expect(() => v.parse(validProbabilityPercentageSchema, 0)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は両端排除で throw', () => {
    expect(() => v.parse(validProbabilityPercentageSchema, 100)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('文字列 "50" は数値型でないため throw（valid 単独は変換しない）', () => {
    expect(() => v.parse(validProbabilityPercentageSchema, '50')).toThrow()
  })
})

describe('validConfidencePercentageSchema', () => {
  it('典型値 99 はそのまま 99 を返す', () => {
    expect(v.parse(validConfidencePercentageSchema, 99)).toBe(99)
  })

  it('境界値 0 は throw', () => {
    expect(() => v.parse(validConfidencePercentageSchema, 0)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は throw', () => {
    expect(() => v.parse(validConfidencePercentageSchema, 100)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('小数 99.5 は整数縛りで throw', () => {
    expect(() => v.parse(validConfidencePercentageSchema, 99.5)).toThrow(/整数/)
  })

  it('文字列 "99" は数値型でないため throw', () => {
    expect(() => v.parse(validConfidencePercentageSchema, '99')).toThrow()
  })
})

describe('validSlipRatePercentageSchema', () => {
  it('境界値 0 はそのまま 0 を返す（両端許容）', () => {
    expect(v.parse(validSlipRatePercentageSchema, 0)).toBe(0)
  })

  it('境界値 100 はそのまま 100 を返す（両端許容）', () => {
    expect(v.parse(validSlipRatePercentageSchema, 100)).toBe(100)
  })

  it('-1 は範囲外で throw', () => {
    expect(() => v.parse(validSlipRatePercentageSchema, -1)).toThrow(
      /0以上100以下/,
    )
  })

  it('101 は範囲外で throw', () => {
    expect(() => v.parse(validSlipRatePercentageSchema, 101)).toThrow(
      /0以上100以下/,
    )
  })

  it('文字列 "50" は数値型でないため throw', () => {
    expect(() => v.parse(validSlipRatePercentageSchema, '50')).toThrow()
  })
})

// 未テスト Input スキーマのエラーメッセージ回帰テスト（AC4 担保）。
// リファクタの安全網が slipRatePercentageSchema（pity.spec.ts）1 件のみのため新設。
describe('probabilityPercentageSchema（合成後の回帰）', () => {
  it('非数値文字列 "abc" は「数値を指定してください。」', () => {
    expect(() => v.parse(probabilityPercentageSchema, 'abc')).toThrow(
      /数値を指定してください/,
    )
  })

  it('境界値 0 は「0より大きく100未満」', () => {
    expect(() => v.parse(probabilityPercentageSchema, 0)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は「0より大きく100未満」', () => {
    expect(() => v.parse(probabilityPercentageSchema, 100)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('文字列 "50" は数値 50 に変換される（合成が機能）', () => {
    expect(v.parse(probabilityPercentageSchema, '50')).toBe(50)
  })
})

describe('confidencePercentageSchema（合成後の回帰）', () => {
  it('小数 99.5 は「整数を指定してください。」', () => {
    expect(() => v.parse(confidencePercentageSchema, 99.5)).toThrow(
      /整数を指定してください/,
    )
  })

  it('範囲外かつ非整数 150.5 は整数エラーが優先される（アクション順序保存）', () => {
    expect(() => v.parse(confidencePercentageSchema, 150.5)).toThrow(/整数/)
  })

  it('境界値 0 は「0より大きく100未満」', () => {
    expect(() => v.parse(confidencePercentageSchema, 0)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は「0より大きく100未満」', () => {
    expect(() => v.parse(confidencePercentageSchema, 100)).toThrow(
      /0より大きく100未満/,
    )
  })
})

describe('targetCountInputSchema（合成後の回帰）', () => {
  it('101 は「目標成功回数は100以下」', () => {
    expect(() => v.parse(targetCountInputSchema, 101)).toThrow(
      /目標成功回数は100以下/,
    )
  })

  it('0 は「目標成功回数は1以上」', () => {
    expect(() => v.parse(targetCountInputSchema, 0)).toThrow(
      /目標成功回数は1以上/,
    )
  })

  it('小数 1.5 は「目標成功回数は整数」', () => {
    expect(() => v.parse(targetCountInputSchema, 1.5)).toThrow(
      /目標成功回数は整数/,
    )
  })
})

describe('trialCountInputSchema（合成後の回帰）', () => {
  it('0 は「試行回数は1以上」', () => {
    expect(() => v.parse(trialCountInputSchema, 0)).toThrow(/試行回数は1以上/)
  })

  it('小数 1.5 は「試行回数は整数」', () => {
    expect(() => v.parse(trialCountInputSchema, 1.5)).toThrow(/試行回数は整数/)
  })
})
