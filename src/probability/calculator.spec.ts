import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  calculateCumulativeSuccessProbability,
  calculateTrialCount,
} from './calculator'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './probability'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
// 入力値域違反（0 / 1 / 負値 / NaN / 非整数等）は v.parse 時点で throw するため計算層へ到達せず、
// 実行時値域検証は form-schemas spec、swap 防止は probability.type-test.ts へ移管済み。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const conf = (r: number) => v.parse(validConfidenceSchema, r)
const trial = (n: number) => v.parse(validTrialCountSchema, n)

describe('calculateTrialCount', () => {
  describe('正常系', () => {
    it('50%の成功率の場合、4回の試行が必要', () => {
      expect(calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap()).toBe(4)
    })

    it('10%の成功率の場合、22回の試行が必要', () => {
      expect(calculateTrialCount(prob(0.1), conf(0.9))._unsafeUnwrap()).toBe(22)
    })

    it('90%の成功率の場合、1回の試行が必要', () => {
      expect(calculateTrialCount(prob(0.9), conf(0.9))._unsafeUnwrap()).toBe(1)
    })

    it('1%の成功率の場合、230回の試行が必要', () => {
      expect(calculateTrialCount(prob(0.01), conf(0.9))._unsafeUnwrap()).toBe(230)
    })

    it('99%の成功率の場合、1回の試行が必要', () => {
      expect(calculateTrialCount(prob(0.99), conf(0.9))._unsafeUnwrap()).toBe(1)
    })

    it('小数点を含む成功率でも計算可能 (0.123)', () => {
      const value = calculateTrialCount(prob(0.123), conf(0.9))._unsafeUnwrap()
      expect(value).toBeGreaterThan(0)
      expect(Number.isFinite(value)).toBe(true)
    })

    it('非常に小さい正の値 (0.0001) は計算可能', () => {
      const value = calculateTrialCount(prob(0.0001), conf(0.9))._unsafeUnwrap()
      expect(value).toBeGreaterThan(0)
      expect(Number.isFinite(value)).toBe(true)
    })

    it('非常に大きい値 (0.9999) は計算可能', () => {
      expect(calculateTrialCount(prob(0.9999), conf(0.9))._unsafeUnwrap()).toBe(1)
    })
  })

  describe('浮動小数点境界（非有限値ガード）', () => {
    it('成功率 1e-17（IEEE754 で 1-p=1 に丸まる）は NonFiniteResult を err 返却', () => {
      expect(calculateTrialCount(prob(1e-17), conf(0.9))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('成功率 Number.MIN_VALUE は NonFiniteResult を err 返却', () => {
      expect(calculateTrialCount(prob(Number.MIN_VALUE), conf(0.9))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('NonFiniteResult は InvalidInput とは区別される', () => {
      const error = calculateTrialCount(prob(5e-17), conf(0.9))._unsafeUnwrapErr()
      expect(error.kind).toBe('NonFiniteResult')
      expect(error.kind).not.toBe('InvalidInput')
    })

    it('実用域の極小値 1e-10 は計算可能で有限', () => {
      const value = calculateTrialCount(prob(1e-10), conf(0.9))._unsafeUnwrap()
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    })
  })

  describe('戻り値の型チェック', () => {
    it('結果は数値型である', () => {
      expect(typeof calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap()).toBe('number')
    })

    it('結果は整数である', () => {
      expect(Number.isInteger(calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap())).toBe(true)
    })

    it('結果は有限値である', () => {
      expect(Number.isFinite(calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap())).toBe(true)
    })

    it('結果は正の値である', () => {
      expect(calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap()).toBeGreaterThan(0)
    })
  })

  describe('信頼度の影響', () => {
    it('成功率0.5・信頼度0.9で4回', () => {
      expect(calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap()).toBe(4)
    })

    it('成功率0.5・信頼度0.99で7回（信頼度上昇）', () => {
      expect(calculateTrialCount(prob(0.5), conf(0.99))._unsafeUnwrap()).toBe(7)
    })

    it('成功率0.5・信頼度0.5で1回（信頼度下降）', () => {
      expect(calculateTrialCount(prob(0.5), conf(0.5))._unsafeUnwrap()).toBe(1)
    })

    it('信頼度を上げると試行回数は単調非減少（成功率0.3固定）', () => {
      const lowConf = calculateTrialCount(prob(0.3), conf(0.5))._unsafeUnwrap()
      const midConf = calculateTrialCount(prob(0.3), conf(0.9))._unsafeUnwrap()
      const highConf = calculateTrialCount(prob(0.3), conf(0.99))._unsafeUnwrap()
      expect(midConf).toBeGreaterThanOrEqual(lowConf)
      expect(highConf).toBeGreaterThanOrEqual(midConf)
    })
  })
})

describe('calculateCumulativeSuccessProbability', () => {
  describe('正常系', () => {
    it('成功率0.5・試行回数4で0.9375を返す', () => {
      expect(calculateCumulativeSuccessProbability(prob(0.5), trial(4))._unsafeUnwrap()).toBeCloseTo(0.9375)
    })

    it('成功率0.5・試行回数1で0.5を返す', () => {
      expect(calculateCumulativeSuccessProbability(prob(0.5), trial(1))._unsafeUnwrap()).toBeCloseTo(0.5)
    })

    it('成功率0.1・試行回数22で0.9以上を返す', () => {
      expect(calculateCumulativeSuccessProbability(prob(0.1), trial(22))._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
    })

    it('戻り値は number 型かつ 0 < r < 1 を満たす', () => {
      const value = calculateCumulativeSuccessProbability(prob(0.3), trial(5))._unsafeUnwrap()
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThan(1)
    })

    it('戻り値は有限値', () => {
      expect(Number.isFinite(calculateCumulativeSuccessProbability(prob(0.5), trial(10))._unsafeUnwrap())).toBe(true)
    })
  })

  describe('浮動小数点境界', () => {
    it('成功率1e-17（極小）・試行回数1で ratio が 0 に飽和し NonFiniteResult', () => {
      expect(calculateCumulativeSuccessProbability(prob(1e-17), trial(1))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })
  })
})

describe('calculateTrialCount と calculateCumulativeSuccessProbability の往復整合', () => {
  it('成功率0.5・信頼度0.9で求めた試行回数で累積確率が0.9以上', () => {
    const n = calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap()
    expect(calculateCumulativeSuccessProbability(prob(0.5), n)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
  })

  it('成功率0.3・信頼度0.99で求めた試行回数で累積確率が0.99以上', () => {
    const n = calculateTrialCount(prob(0.3), conf(0.99))._unsafeUnwrap()
    expect(calculateCumulativeSuccessProbability(prob(0.3), n)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.99)
  })

  it('成功率0.01・信頼度0.9で求めた試行回数で累積確率が0.9以上', () => {
    const n = calculateTrialCount(prob(0.01), conf(0.9))._unsafeUnwrap()
    expect(calculateCumulativeSuccessProbability(prob(0.01), n)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
  })
})

describe('validTrialCountSchema', () => {
  it('典型値1を渡すとそのまま1を返す', () => {
    expect(v.parse(validTrialCountSchema, 1)).toBe(1)
  })

  it('正の整数（10000）を渡すとそのまま返す', () => {
    expect(v.parse(validTrialCountSchema, 10000)).toBe(10000)
  })

  it('0を渡すとValiError、メッセージに「試行回数」を含む', () => {
    expect(() => v.parse(validTrialCountSchema, 0)).toThrow(/試行回数/)
  })

  it('小数1.5を渡すとValiError、メッセージに「試行回数」を含む', () => {
    expect(() => v.parse(validTrialCountSchema, 1.5)).toThrow(/試行回数/)
  })

  it('負値-1を渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validTrialCountSchema, -1)).toThrow()
  })

  it('文字列を渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validTrialCountSchema, '5')).toThrow()
  })

  it('NaNを渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validTrialCountSchema, NaN)).toThrow()
  })

  it('InfinityはValiErrorをスローする（整数チェックで弾かれる）', () => {
    expect(() => v.parse(validTrialCountSchema, Infinity)).toThrow()
  })
})

describe('validProbabilityRatioSchema', () => {
  it('エラーメッセージに「成功率」を含む', () => {
    expect(() => v.parse(validProbabilityRatioSchema, 0)).toThrow(/成功率/)
    expect(() => v.parse(validProbabilityRatioSchema, 1)).toThrow(/成功率/)
  })
})

describe('validConfidenceSchema', () => {
  it('典型値0.9を渡すとそのまま0.9を返す', () => {
    expect(v.parse(validConfidenceSchema, 0.9)).toBe(0.9)
  })

  it('0を渡すとValiError、メッセージに「信頼度」を含む', () => {
    expect(() => v.parse(validConfidenceSchema, 0)).toThrow(/信頼度/)
  })

  it('1を渡すとValiError、メッセージに「信頼度」を含む', () => {
    expect(() => v.parse(validConfidenceSchema, 1)).toThrow(/信頼度/)
  })

  it('-0.1を渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validConfidenceSchema, -0.1)).toThrow()
  })

  it('1.5を渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validConfidenceSchema, 1.5)).toThrow()
  })

  it('文字列を渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validConfidenceSchema, '0.9')).toThrow()
  })
})
