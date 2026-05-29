import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { calculateCumulativeSuccessProbability } from './cumulative-probability'
import {
  validCumulativeSuccessRatioSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './value-types'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const trial = (n: number) => v.parse(validTrialCountSchema, n)

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

describe('validCumulativeSuccessRatioSchema', () => {
  it('典型値0.5を渡すとそのまま0.5を返す', () => {
    expect(v.parse(validCumulativeSuccessRatioSchema, 0.5)).toBe(0.5)
  })

  it('上限1（閉区間）を渡すとそのまま1を返す', () => {
    expect(v.parse(validCumulativeSuccessRatioSchema, 1)).toBe(1)
  })

  it('下限0（開区間）はValiError、メッセージに「累積成功率」を含む', () => {
    expect(() => v.parse(validCumulativeSuccessRatioSchema, 0)).toThrow(/累積成功率/)
  })

  it('1超1.0001はValiError、メッセージに「累積成功率」を含む', () => {
    expect(() => v.parse(validCumulativeSuccessRatioSchema, 1.0001)).toThrow(/累積成功率/)
  })

  it('負値-0.1はValiErrorをスローする', () => {
    expect(() => v.parse(validCumulativeSuccessRatioSchema, -0.1)).toThrow()
  })

  it('NaNを渡すとValiErrorをスローする', () => {
    expect(() => v.parse(validCumulativeSuccessRatioSchema, NaN)).toThrow()
  })
})
