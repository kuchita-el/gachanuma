import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { calculateTrialCountOnCurve, evaluateSuccessCurve, type SuccessCurve } from './success-curve'
import { calculateCumulativeSuccessProbability } from './cumulative-probability'
import { calculateTrialCountForMultipleSuccess } from './required-trials'
import { calculateTrialCountWithPity } from './required-trials-with-pity'
import {
  validConfidenceSchema,
  validPityCountSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTargetCountSchema,
  validTrialCountSchema,
} from './value-types'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const conf = (r: number) => v.parse(validConfidenceSchema, r)
const slip = (r: number) => v.parse(validSlipRateRatioSchema, r)
const pity = (n: number) => v.parse(validPityCountSchema, n)
const target = (n: number) => v.parse(validTargetCountSchema, n)
const trial = (n: number) => v.parse(validTrialCountSchema, n)

const single = (p: number): SuccessCurve => ({ kind: 'single', successRate: prob(p) })
const multiple = (p: number, r: number): SuccessCurve =>
  ({ kind: 'multiple', successRate: prob(p), targetCount: target(r) })
const withPity = (p: number, n: number, m: number): SuccessCurve =>
  ({ kind: 'pity', successRate: prob(p), pityCount: pity(n), slipRate: slip(m) })

const evaluate = (curve: SuccessCurve, k: number) => evaluateSuccessCurve(curve, trial(k))._unsafeUnwrap()

/**
 * 不完全ベータの数値誤差の許容幅。必要回数の計算（required-trials.ts の EPS_THRESHOLD）と揃える。
 * 確率がちょうど信頼度に等しくなる入力（例: p=0.5, r=2, c=0.5）で、わずかに下回ることがあるため。
 */
const EPS = 1e-12

describe('evaluateSuccessCurve', () => {
  describe('single', () => {
    it('calculateCumulativeSuccessProbability と同じ値を返す（p=0.01, k=230 → 0.9009…）', () => {
      expect(evaluate(single(0.01), 230)).toBe(
        calculateCumulativeSuccessProbability(prob(0.01), trial(230))._unsafeUnwrap(),
      )
    })

    it('成功率が極小（1e-17）では NonFiniteResult を返す', () => {
      expect(evaluateSuccessCurve(single(1e-17), trial(10))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })
  })

  describe('multiple', () => {
    it('目標成功回数 1 は single と同じ値を返す', () => {
      expect(evaluate(multiple(0.3, 1), 5)).toBe(evaluate(single(0.3), 5))
    })

    it('試行回数が目標成功回数未満なら 0（3回成功したいのに2回しか試行しない）', () => {
      expect(evaluate(multiple(0.5, 3), 2)).toBe(0)
    })

    it('試行回数 = 目標成功回数なら p^r（p=0.5, r=2, k=2 → 0.25）', () => {
      expect(evaluate(multiple(0.5, 2), 2)).toBeCloseTo(0.25, 12)
    })

    it('二項分布の手計算と一致する（p=0.5, r=2, k=4 → 1 − (1+4)/16 = 0.6875）', () => {
      expect(evaluate(multiple(0.5, 2), 4)).toBeCloseTo(0.6875, 12)
    })

    it('試行回数について単調非減少', () => {
      const curve = multiple(0.05, 5)
      let prev = 0
      for (let k = 1; k <= 400; k++) {
        const value = evaluate(curve, k)
        expect(value).toBeGreaterThanOrEqual(prev - EPS)
        prev = value
      }
    })
  })

  describe('pity', () => {
    it('天井回数未満は 1 − (1−p)^k（p=0.01, N=100, k=99）', () => {
      expect(evaluate(withPity(0.01, 100, 0), 99)).toBeCloseTo(1 - 0.99 ** 99, 12)
    })

    it('すり抜け率 0% なら天井回数で 1 に達する', () => {
      expect(evaluate(withPity(0.01, 100, 0), 100)).toBe(1)
    })

    it('天井回数以降は 1 − (1−p)^(k−1) × m（p=0.01, N=100, m=0.5, k=150）', () => {
      expect(evaluate(withPity(0.01, 100, 0.5), 150)).toBeCloseTo(1 - 0.99 ** 149 * 0.5, 12)
    })

    it('すり抜け率 100% なら、天井回数目の試行は必ず外れる（以降は試行1回分少ない single と同じ）', () => {
      expect(evaluate(withPity(0.01, 100, 1), 50)).toBeCloseTo(evaluate(single(0.01), 50), 12)
      expect(evaluate(withPity(0.01, 100, 1), 100)).toBeCloseTo(evaluate(single(0.01), 99), 12)
      expect(evaluate(withPity(0.01, 100, 1), 150)).toBeCloseTo(evaluate(single(0.01), 149), 12)
    })

    it('成功率が極小でも err にせず、天井回数未満は 0、天井回数で 1 − m になる', () => {
      const curve = withPity(1e-17, 10, 0.25)
      expect(evaluate(curve, 5)).toBe(0)
      expect(evaluate(curve, 10)).toBe(0.75)
    })
  })
})

describe('calculateTrialCountOnCurve', () => {
  it('モデルごとに既存の計算関数と同じ値を返す', () => {
    expect(calculateTrialCountOnCurve(single(0.01), conf(0.9))._unsafeUnwrap()).toBe(230)
    expect(calculateTrialCountOnCurve(multiple(0.01, 3), conf(0.9))._unsafeUnwrap()).toBe(
      calculateTrialCountForMultipleSuccess(prob(0.01), target(3), conf(0.9))._unsafeUnwrap(),
    )
    expect(calculateTrialCountOnCurve(withPity(0.01, 100, 0.5), conf(0.9))._unsafeUnwrap()).toBe(
      calculateTrialCountWithPity(prob(0.01), pity(100), slip(0.5), conf(0.9))._unsafeUnwrap(),
    )
  })

  // グラフと計算結果の一致（Issue #8）: 結果 N で曲線が信頼度以上、N−1 では信頼度未満になる
  describe('結果 N で曲線が信頼度に到達し、N−1 では未到達', () => {
    const curves: [string, SuccessCurve][] = [
      ['single p=0.01', single(0.01)],
      ['single p=0.5', single(0.5)],
      ['multiple p=0.01 r=2', multiple(0.01, 2)],
      ['multiple p=0.01 r=10', multiple(0.01, 10)],
      ['multiple p=0.5 r=2', multiple(0.5, 2)],
      ['multiple p=0.3 r=100', multiple(0.3, 100)],
      ['pity p=0.01 N=100 m=0', withPity(0.01, 100, 0)],
      ['pity p=0.01 N=100 m=0.5', withPity(0.01, 100, 0.5)],
      ['pity p=0.006 N=90 m=0.5', withPity(0.006, 90, 0.5)],
      ['pity p=0.1 N=100 m=0.5', withPity(0.1, 100, 0.5)],
      ['pity p=0.01 N=100 m=1', withPity(0.01, 100, 1)],
    ]
    const confidences = [0.5, 0.75, 0.9, 0.95, 0.99]
    for (const [name, curve] of curves) {
      it(name, () => {
        for (const c of confidences) {
          const n = calculateTrialCountOnCurve(curve, conf(c))._unsafeUnwrap()
          expect(evaluate(curve, n) + EPS).toBeGreaterThanOrEqual(c)
          if (n > 1) {
            expect(evaluate(curve, n - 1)).toBeLessThan(c)
          }
        }
      })
    }
  })
})
