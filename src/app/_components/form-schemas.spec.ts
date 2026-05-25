import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  numericInputSchema,
  validProbabilityPercentageSchema,
  validConfidencePercentageSchema,
  validSlipRatePercentageSchema,
  probabilityPercentageSchema,
  confidencePercentageSchema,
  slipRatePercentageSchema,
  targetCountInputSchema,
  trialCountInputSchema,
  percentToRatio,
  ratioToPercent,
} from './form-schemas'

describe('numericInputSchema', () => {
  describe('正常系', () => {
    it('文字列 "50" を渡すと数値 50 に変換される', () => {
      expect(v.parse(numericInputSchema, '50')).toBe(50)
    })

    it('小数文字列 "3.14" を渡すと数値 3.14 に変換される', () => {
      expect(v.parse(numericInputSchema, '3.14')).toBe(3.14)
    })

    it('負の小数文字列 "-12.5" を渡すと -12.5 に変換される', () => {
      expect(v.parse(numericInputSchema, '-12.5')).toBe(-12.5)
    })

    it('先頭ピリオド文字列 ".5" を渡すと 0.5 に変換される', () => {
      expect(v.parse(numericInputSchema, '.5')).toBe(0.5)
    })
  })

  describe('異常系（parseFloat 貪欲解釈の厳格化）', () => {
    it('NaN になる文字列 "abc" は「数値を指定してください。」エラーになる', () => {
      expect(() => v.parse(numericInputSchema, 'abc')).toThrow(/数値を指定してください。/)
    })

    it('数値混じり文字列 "12abc" は 12 として通過せずエラー', () => {
      expect(() => v.parse(numericInputSchema, '12abc')).toThrow(/数値を指定してください。/)
    })

    it('千区切り "5,000" は 5 として通過せずエラー', () => {
      expect(() => v.parse(numericInputSchema, '5,000')).toThrow(/数値を指定してください。/)
    })

    it('指数表記 "1e2" は 100 として通過せずエラー', () => {
      expect(() => v.parse(numericInputSchema, '1e2')).toThrow(/数値を指定してください。/)
    })

    it('16進表記 "0x10" は 0 として通過せずエラー', () => {
      expect(() => v.parse(numericInputSchema, '0x10')).toThrow(/数値を指定してください。/)
    })

    it('"Infinity" 文字列は通過せずエラー', () => {
      expect(() => v.parse(numericInputSchema, 'Infinity')).toThrow(/数値を指定してください。/)
    })

    it('空文字列 "" はエラー', () => {
      expect(() => v.parse(numericInputSchema, '')).toThrow(/数値を指定してください。/)
    })

    it('前後空白付き " 50" は 50 として通過せずエラー', () => {
      expect(() => v.parse(numericInputSchema, ' 50')).toThrow(/数値を指定してください。/)
    })

    it('後空白付き "50 " はエラー', () => {
      expect(() => v.parse(numericInputSchema, '50 ')).toThrow(/数値を指定してください。/)
    })
  })
})

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

// フォーム入力合成スキーマ（numericInputSchema + valid）の回帰テスト。
// 文字列→数値変換が機能し、値域・整数エラーが valid 側のメッセージで返ることを担保する。
describe('probabilityPercentageSchema（合成後の回帰）', () => {
  it('非数値文字列 "abc" は「数値を指定してください。」', () => {
    expect(() => v.parse(probabilityPercentageSchema, 'abc')).toThrow(
      /数値を指定してください/,
    )
  })

  it('境界値 0 は「0より大きく100未満」', () => {
    expect(() => v.parse(probabilityPercentageSchema, '0')).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は「0より大きく100未満」', () => {
    expect(() => v.parse(probabilityPercentageSchema, '100')).toThrow(
      /0より大きく100未満/,
    )
  })

  it('文字列 "50" は数値 50 に変換される（合成が機能）', () => {
    expect(v.parse(probabilityPercentageSchema, '50')).toBe(50)
  })
})

describe('confidencePercentageSchema（合成後の回帰）', () => {
  it('小数 99.5 は「整数を指定してください。」', () => {
    expect(() => v.parse(confidencePercentageSchema, '99.5')).toThrow(
      /整数を指定してください/,
    )
  })

  it('範囲外かつ非整数 150.5 は整数エラーが優先される（アクション順序保存）', () => {
    expect(() => v.parse(confidencePercentageSchema, '150.5')).toThrow(/整数/)
  })

  it('境界値 0 は「0より大きく100未満」', () => {
    expect(() => v.parse(confidencePercentageSchema, '0')).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は「0より大きく100未満」', () => {
    expect(() => v.parse(confidencePercentageSchema, '100')).toThrow(
      /0より大きく100未満/,
    )
  })
})

describe('slipRatePercentageSchema（合成後の回帰）', () => {
  it('境界値 0 を渡すとそのまま 0 を返す', () => {
    expect(v.parse(slipRatePercentageSchema, '0')).toBe(0)
  })

  it('境界値 100 を渡すとそのまま 100 を返す', () => {
    expect(v.parse(slipRatePercentageSchema, '100')).toBe(100)
  })

  it('文字列 "50" を渡すと 50 に変換される', () => {
    expect(v.parse(slipRatePercentageSchema, '50')).toBe(50)
  })

  it('-1 で ValiError、メッセージに「0以上100以下」を含む', () => {
    expect(() => v.parse(slipRatePercentageSchema, '-1')).toThrow(/0以上100以下/)
  })

  it('101 で ValiError', () => {
    expect(() => v.parse(slipRatePercentageSchema, '101')).toThrow(/0以上100以下/)
  })
})

describe('targetCountInputSchema（合成後の回帰）', () => {
  it('101 は「目標成功回数は100以下」', () => {
    expect(() => v.parse(targetCountInputSchema, '101')).toThrow(
      /目標成功回数は100以下/,
    )
  })

  it('0 は「目標成功回数は1以上」', () => {
    expect(() => v.parse(targetCountInputSchema, '0')).toThrow(
      /目標成功回数は1以上/,
    )
  })

  it('小数 1.5 は「目標成功回数は整数」', () => {
    expect(() => v.parse(targetCountInputSchema, '1.5')).toThrow(
      /目標成功回数は整数/,
    )
  })
})

describe('trialCountInputSchema（合成後の回帰）', () => {
  it('0 は「試行回数は1以上」', () => {
    expect(() => v.parse(trialCountInputSchema, '0')).toThrow(/試行回数は1以上/)
  })

  it('小数 1.5 は「試行回数は整数」', () => {
    expect(() => v.parse(trialCountInputSchema, '1.5')).toThrow(/試行回数は整数/)
  })
})

describe('percentToRatio', () => {
  it('50を渡すと0.5を返す', () => {
    expect(percentToRatio(50)).toBeCloseTo(0.5)
  })

  it('100を渡すと1、0を渡すと0を返す（バリデーションなし純関数）', () => {
    expect(percentToRatio(100)).toBeCloseTo(1)
    expect(percentToRatio(0)).toBeCloseTo(0)
  })

  it('0.5（小数パーセント）を渡すと0.005を返す', () => {
    expect(percentToRatio(0.5)).toBeCloseTo(0.005)
  })
})

describe('ratioToPercent', () => {
  it('0.5を渡すと50を返す', () => {
    expect(ratioToPercent(0.5)).toBeCloseTo(50)
  })

  it('1を渡すと100、0を渡すと0を返す（バリデーションなし純関数）', () => {
    expect(ratioToPercent(1)).toBeCloseTo(100)
    expect(ratioToPercent(0)).toBeCloseTo(0)
  })
})

describe('変換ユーティリティの往復整合', () => {
  it('ratioToPercent(percentToRatio(p)) === p（任意のpで成立）', () => {
    for (const p of [1, 10, 50, 99]) {
      expect(ratioToPercent(percentToRatio(p))).toBeCloseTo(p)
    }
  })

  it('percentToRatio(ratioToPercent(r)) === r（任意のrで成立）', () => {
    for (const r of [0.01, 0.5, 0.9, 0.99]) {
      expect(percentToRatio(ratioToPercent(r))).toBeCloseTo(r)
    }
  })
})
