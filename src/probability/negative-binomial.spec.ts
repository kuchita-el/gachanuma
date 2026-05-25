import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { calculateTrialCountForMultipleSuccess } from './negative-binomial'
import { calculateTrialCount } from './calculator'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTargetCountSchema,
} from './probability'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const conf = (r: number) => v.parse(validConfidenceSchema, r)
const target = (n: number) => v.parse(validTargetCountSchema, n)

describe('calculateTrialCountForMultipleSuccess', () => {
  describe('targetCount=1 で calculateTrialCount と同一値（回帰）', () => {
    const cases: Array<[number, number, number]> = [
      [0.01, 0.9, 230],
      [0.1, 0.9, 22],
      [0.5, 0.9, 4],
      [0.5, 0.99, 7],
      [0.99, 0.9, 1],
    ]
    for (const [p, c, expected] of cases) {
      it(`p=${p}, targetCount=1, c=${c} → ${expected}`, () => {
        expect(calculateTrialCountForMultipleSuccess(prob(p), target(1), conf(c))._unsafeUnwrap()).toBe(expected)
        expect(calculateTrialCountForMultipleSuccess(prob(p), target(1), conf(c))._unsafeUnwrap()).toBe(
          calculateTrialCount(prob(p), conf(c))._unsafeUnwrap(),
        )
      })
    }
  })

  describe('正常系（targetCount >= 2）', () => {
    it('p=0.5, targetCount=2, c=0.9 → 7', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(2), conf(0.9))._unsafeUnwrap()).toBe(7)
    })

    it('p=0.5, targetCount=10, c=0.9 → 26（厳密値）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(10), conf(0.9))._unsafeUnwrap()).toBe(26)
    })

    it('p=0.1, targetCount=5, c=0.9 → 78（厳密値）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.1), target(5), conf(0.9))._unsafeUnwrap()).toBe(78)
    })

    it('p=0.5, targetCount=100, c=0.9 → 218（厳密値、正規近似 k≈218 と整合）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(100), conf(0.9))._unsafeUnwrap()).toBe(218)
    })
  })

  describe('単調性', () => {
    it('targetCount 増加に対し試行回数は単調非減少', () => {
      const ns = [1, 2, 5, 10, 20].map(t =>
        calculateTrialCountForMultipleSuccess(prob(0.5), target(t), conf(0.9))._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountForMultipleSuccess(prob(0.5), target(3), conf(c))._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, targetCount=1 は NonFiniteResult（既存 calculateTrialCount 経由）', () => {
      const result = calculateTrialCountForMultipleSuccess(prob(1e-17), target(1), conf(0.9))
      expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('p=1e-17, targetCount=2 では反復上限超過で IterationLimitExceeded', () => {
      const result = calculateTrialCountForMultipleSuccess(prob(1e-17), target(2), conf(0.9))
      expect(result._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })
  })
})

describe('validTargetCountSchema', () => {
  it('典型値 1 を渡すとそのまま 1 を返す', () => {
    expect(v.parse(validTargetCountSchema, 1)).toBe(1)
  })

  it('境界値 100 を渡すとそのまま 100 を返す', () => {
    expect(v.parse(validTargetCountSchema, 100)).toBe(100)
  })

  it('0 を渡すと ValiError、メッセージに「目標成功回数」を含む', () => {
    expect(() => v.parse(validTargetCountSchema, 0)).toThrow(/目標成功回数/)
  })

  it('101 を渡すと ValiError、メッセージに「100以下」を含む', () => {
    expect(() => v.parse(validTargetCountSchema, 101)).toThrow(/100以下/)
  })

  it('1.5（小数）を渡すと ValiError、メッセージに「整数」を含む', () => {
    expect(() => v.parse(validTargetCountSchema, 1.5)).toThrow(/整数/)
  })

  it('文字列を渡すと ValiError', () => {
    expect(() => v.parse(validTargetCountSchema, '5')).toThrow()
  })

  it('NaN を渡すと ValiError', () => {
    expect(() => v.parse(validTargetCountSchema, NaN)).toThrow()
  })
})
