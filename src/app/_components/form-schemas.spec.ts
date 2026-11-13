import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  normalizeNumericInput,
  numericInputSchema,
  probabilityPercentageSchema,
  confidencePercentageSchema,
  slipRatePercentageSchema,
  targetCountInputSchema,
  trialCountInputSchema,
  pityCountInputSchema,
  percentToRatio,
  ratioToPercent,
} from './form-schemas'

describe('numericInputSchema', () => {
  describe('正常系', () => {
    it('文字列 "50" を渡すと数値 50 に変換される', () => {
      expect(v.parse(numericInputSchema, '50')).toBe(50)
    })

    it('数値 50 を渡すとそのまま 50 を返す', () => {
      expect(v.parse(numericInputSchema, 50)).toBe(50)
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

  // type="text" 化に伴い、IME の全角数字がそのまま入力されるため検証前に正規化する（Issue #13）。
  describe('全角数字・前後空白の正規化', () => {
    it('全角数字 "１０" は 10 に変換される', () => {
      expect(v.parse(numericInputSchema, '１０')).toBe(10)
    })

    it('全角小数 "０．５" は 0.5 に変換される', () => {
      expect(v.parse(numericInputSchema, '０．５')).toBe(0.5)
    })

    it('全角マイナス "－１２．５" は -12.5 に変換される', () => {
      expect(v.parse(numericInputSchema, '－１２．５')).toBe(-12.5)
    })

    it('前空白付き " 50" は trim されて 50 になる', () => {
      expect(v.parse(numericInputSchema, ' 50')).toBe(50)
    })

    it('後空白付き "50 " は trim されて 50 になる', () => {
      expect(v.parse(numericInputSchema, '50 ')).toBe(50)
    })

    it('全角空白付き "　５０　" は trim されて 50 になる', () => {
      expect(v.parse(numericInputSchema, '　５０　')).toBe(50)
    })

    it('空白のみ "  " は空文字列扱いでエラー', () => {
      expect(() => v.parse(numericInputSchema, '  ')).toThrow(/数値を指定してください。/)
    })

    it('全角でも全体一致は維持され "１２ａｂｃ" はエラー', () => {
      expect(() => v.parse(numericInputSchema, '１２ａｂｃ')).toThrow(/数値を指定してください。/)
    })

    it('全角でも指数表記 "１ｅ２" はエラー', () => {
      expect(() => v.parse(numericInputSchema, '１ｅ２')).toThrow(/数値を指定してください。/)
    })

    it('中間の空白 "5 0" は trim 対象外でエラー', () => {
      expect(() => v.parse(numericInputSchema, '5 0')).toThrow(/数値を指定してください。/)
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
  })
})

// rate 系フォーム入力合成スキーマ（Issue #114: branded ratio 出力）の回帰テスト。
// percent 入力 → ratio 値域検証（percent 文言）→ branded ratio 出力までを担保する。
// 値域エラー文言は percent 系を維持し、出力は計算層の branded ratio になる点が改修の中核。
describe('probabilityPercentageSchema（percent 入力 → branded ratio 出力）', () => {
  it('非数値文字列 "abc" は「数値を指定してください。」', () => {
    expect(() => v.parse(probabilityPercentageSchema, 'abc')).toThrow(
      /数値を指定してください/,
    )
  })

  it('境界値 0 は「0より大きく100未満」（両端排除・percent 文言維持）', () => {
    expect(() => v.parse(probabilityPercentageSchema, 0)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 100 は「0より大きく100未満」（両端排除・percent 文言維持）', () => {
    expect(() => v.parse(probabilityPercentageSchema, 100)).toThrow(
      /0より大きく100未満/,
    )
  })

  it('文字列 "50" は ratio 0.5 へ変換・ブランド化される（AC3: ratio 単一化）', () => {
    expect(v.parse(probabilityPercentageSchema, '50')).toBeCloseTo(0.5)
  })

  it('文字列 "90" は ratio 0.9 を返す（percent→ratio 合流の検証）', () => {
    expect(v.parse(probabilityPercentageSchema, '90')).toBeCloseTo(0.9)
  })
})

describe('confidencePercentageSchema（整数文字列 → branded ratio 出力）', () => {
  it('小数文字列 "99.5" は「整数を指定してください。」', () => {
    expect(() => v.parse(confidencePercentageSchema, '99.5')).toThrow(
      /整数を指定してください/,
    )
  })

  it('範囲外かつ非整数 "150.5" は整数エラーが優先される（アクション順序保存）', () => {
    expect(() => v.parse(confidencePercentageSchema, '150.5')).toThrow(/整数/)
  })

  it('小数表記 "90.0"（値は整数相当）も小数桁ありとして「整数を指定してください。」で弾く', () => {
    expect(() => v.parse(confidencePercentageSchema, '90.0')).toThrow(
      /整数を指定してください/,
    )
  })

  it('整数文字列 "90" は ratio 0.9 へ変換・ブランド化される', () => {
    expect(v.parse(confidencePercentageSchema, '90')).toBeCloseTo(0.9)
  })

  it('境界値 "0" は「0より大きく100未満」', () => {
    expect(() => v.parse(confidencePercentageSchema, '0')).toThrow(
      /0より大きく100未満/,
    )
  })

  it('境界値 "100" は「0より大きく100未満」', () => {
    expect(() => v.parse(confidencePercentageSchema, '100')).toThrow(
      /0より大きく100未満/,
    )
  })

  it('空文字列 "" は「数値を指定してください。」（整数チェックに優先）', () => {
    expect(() => v.parse(confidencePercentageSchema, '')).toThrow(
      /数値を指定してください/,
    )
  })

  it('非数値文字列 "abc" は「数値を指定してください。」', () => {
    expect(() => v.parse(confidencePercentageSchema, 'abc')).toThrow(
      /数値を指定してください/,
    )
  })

  it('全角整数 "９０" は ratio 0.9 へ変換される（Issue #13: 正規化）', () => {
    expect(v.parse(confidencePercentageSchema, '９０')).toBeCloseTo(0.9)
  })

  it('全角小数 "９９．５" は正規化後に「整数を指定してください。」', () => {
    expect(() => v.parse(confidencePercentageSchema, '９９．５')).toThrow(
      /整数を指定してください/,
    )
  })
})

describe('slipRatePercentageSchema（percent 入力 → branded ratio 出力）', () => {
  it('境界値 0 は ratio 0 を返す（両端許容）', () => {
    expect(v.parse(slipRatePercentageSchema, 0)).toBeCloseTo(0)
  })

  it('境界値 100 は ratio 1 を返す（両端許容）', () => {
    expect(v.parse(slipRatePercentageSchema, 100)).toBeCloseTo(1)
  })

  it('文字列 "50" は ratio 0.5 へ変換される', () => {
    expect(v.parse(slipRatePercentageSchema, '50')).toBeCloseTo(0.5)
  })

  it('-1 で ValiError、メッセージに「0以上100以下」を含む', () => {
    expect(() => v.parse(slipRatePercentageSchema, -1)).toThrow(/0以上100以下/)
  })

  it('101 で ValiError', () => {
    expect(() => v.parse(slipRatePercentageSchema, 101)).toThrow(/0以上100以下/)
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

// 計算層から移管した天井回数の実行時値域検証の受け皿（UI 入口スキーマの責務）。
// 試行回数とは別概念のため「天井回数」文言で返る（UI 層 TrialCount 流用解消）。
describe('pityCountInputSchema（合成後の回帰）', () => {
  it('文字列 "100" を渡すと数値 100 に変換される（合成が機能）', () => {
    expect(v.parse(pityCountInputSchema, '100')).toBe(100)
  })

  it('境界値 1 はそのまま 1 を返す', () => {
    expect(v.parse(pityCountInputSchema, 1)).toBe(1)
  })

  it('0 は「天井回数は1以上」', () => {
    expect(() => v.parse(pityCountInputSchema, 0)).toThrow(/天井回数は1以上/)
  })

  it('負値 -1 は「天井回数は1以上」', () => {
    expect(() => v.parse(pityCountInputSchema, -1)).toThrow(/天井回数は1以上/)
  })

  it('小数 1.5 は「天井回数は整数」', () => {
    expect(() => v.parse(pityCountInputSchema, 1.5)).toThrow(/天井回数は整数/)
  })

  it('非数値文字列 "abc" は「数値を指定してください。」', () => {
    expect(() => v.parse(pityCountInputSchema, 'abc')).toThrow(/数値を指定してください/)
  })
})

describe('normalizeNumericInput', () => {
  it('全角数字・全角ピリオドを半角にする', () => {
    expect(normalizeNumericInput('１２３．４５')).toBe('123.45')
  })

  it('前後の半角・全角空白を除去する', () => {
    expect(normalizeNumericInput(' 　10　 ')).toBe('10')
  })

  it('半角のみの文字列はそのまま返す', () => {
    expect(normalizeNumericInput('3.14')).toBe('3.14')
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
