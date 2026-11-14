import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  computeNiceTicks,
  computeXAxisRange,
  computeXAxisUpperBound,
  sampleTrialCounts,
} from './chart-range'
import type { SuccessCurve } from '@/probability/success-curve'
import { formatDomainError } from '@/lib/format-domain-error'
import {
  validPityCountSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTargetCountSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const trial = (n: number) => v.parse(validTrialCountSchema, n)
const single = (p: number): SuccessCurve => ({ kind: 'single', successRate: prob(p) })

describe('computeXAxisUpperBound', () => {
  it('p=0.5 → 11（N99=7, ceil(10.5)=11、AC2 検証）', () => {
    expect(computeXAxisUpperBound(single(0.5))._unsafeUnwrap()).toBe(11)
  })

  it('p=0.1 → 66（N99=44, ceil(66)=66）', () => {
    expect(computeXAxisUpperBound(single(0.1))._unsafeUnwrap()).toBe(66)
  })

  it('p=0.9 → 3（N99=2, ceil(3)=3、高成功率境界）', () => {
    expect(computeXAxisUpperBound(single(0.9))._unsafeUnwrap()).toBe(3)
  })

  it('p=0.01 → 689（N99=459, ceil(688.5)=689）', () => {
    expect(computeXAxisUpperBound(single(0.01))._unsafeUnwrap()).toBe(689)
  })

  it('p 極小（1e-17）は NonFiniteResult を err 返却（required-trials 経由）', () => {
    expect(computeXAxisUpperBound(single(1e-17))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
  })

  it('複数回成功の曲線では、その曲線が 99% に届く回数の 1.5 倍になる（p=0.01, r=3 → N99=838 → 1257）', () => {
    const curve: SuccessCurve = {
      kind: 'multiple',
      successRate: prob(0.01),
      targetCount: v.parse(validTargetCountSchema, 3),
    }
    expect(computeXAxisUpperBound(curve)._unsafeUnwrap()).toBe(1257)
  })

  it('天井ありの曲線では、その曲線が 99% に届く回数の 1.5 倍になる（p=0.01, N=100, m=0 → N99=100 → 150）', () => {
    const curve: SuccessCurve = {
      kind: 'pity',
      successRate: prob(0.01),
      pityCount: v.parse(validPityCountSchema, 100),
      slipRate: v.parse(validSlipRateRatioSchema, 0),
    }
    expect(computeXAxisUpperBound(curve)._unsafeUnwrap()).toBe(150)
  })

  it('include を渡すと、その 1.2 倍（切り上げ）以上になる（p=0.5, include=1000 → 1200）', () => {
    expect(computeXAxisUpperBound(single(0.5), trial(1000))._unsafeUnwrap()).toBe(1200)
  })

  describe('99% に届く回数が計算できないとき（複数回成功で反復上限を超える）', () => {
    // 成功率 0.01%・目標 100 回: 信頼度 50% の結果は約 100 万回で計算できるが、99% は反復上限を超える
    const curve: SuccessCurve = {
      kind: 'multiple',
      successRate: prob(0.0001),
      targetCount: v.parse(validTargetCountSchema, 100),
    }

    it('include を渡せば、その 1.2 倍で上限を決める（グラフだけエラーにしない）', () => {
      expect(computeXAxisUpperBound(curve, trial(1_000_000))._unsafeUnwrap()).toBe(1_200_000)
    })

    it('include がなければ、計算エラーをそのまま返す', () => {
      expect(computeXAxisUpperBound(curve)._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })
  })

  it('include が小さければ N99 × 1.5 のまま（p=0.01, include=230 → 689）', () => {
    expect(computeXAxisUpperBound(single(0.01), trial(230))._unsafeUnwrap()).toBe(689)
  })
})

describe('sampleTrialCounts', () => {
  it('upperBound <= maxPoints では全整数を返す（upperBound=11 → [1..11]）', () => {
    expect(sampleTrialCounts(trial(11))._unsafeUnwrap()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('upperBound=1 では [1]', () => {
    expect(sampleTrialCounts(trial(1))._unsafeUnwrap()).toEqual([1])
  })

  it('upperBound=200, maxPoints=200 では全整数 [1..200]', () => {
    const arr = sampleTrialCounts(trial(200))._unsafeUnwrap()
    expect(arr).toHaveLength(200)
    expect(arr[0]).toBe(1)
    expect(arr[199]).toBe(200)
  })

  it('upperBound=689, maxPoints=200 では 200 点以下に圧縮、先頭1・末尾689', () => {
    const arr = sampleTrialCounts(trial(689))._unsafeUnwrap()
    expect(arr.length).toBeLessThanOrEqual(200)
    expect(arr[0]).toBe(1)
    expect(arr[arr.length - 1]).toBe(689)
  })

  it('単調増加であること', () => {
    const arr = sampleTrialCounts(trial(689))._unsafeUnwrap()
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]!).toBeGreaterThan(arr[i - 1]!)
    }
  })

  it('全要素が整数', () => {
    const arr = sampleTrialCounts(trial(689))._unsafeUnwrap()
    for (const n of arr) {
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('全要素が 1 以上 upperBound 以下', () => {
    const arr = sampleTrialCounts(trial(689))._unsafeUnwrap()
    for (const n of arr) {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(689)
    }
  })

  it('maxPoints をカスタムに指定できる', () => {
    const arr = sampleTrialCounts(trial(1000), 10)._unsafeUnwrap()
    expect(arr.length).toBeLessThanOrEqual(10)
    expect(arr[0]).toBe(1)
    expect(arr[arr.length - 1]).toBe(1000)
  })

  it('maxPoints=1 は InvalidInput を err 返却（2以上必須、0除算を防ぐ）', () => {
    const result = sampleTrialCounts(trial(100), 1)
    expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/maxPoints/)
  })

  it('maxPoints=0 は InvalidInput を err 返却', () => {
    expect(sampleTrialCounts(trial(100), 0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })
})

describe('computeNiceTicks', () => {
  it.each([
    [1, [0, 1]],
    [3, [0, 1, 2, 3]],
    [4, [0, 1, 2, 3, 4]],
    [11, [0, 5, 10, 15]],
    [66, [0, 20, 40, 60, 80]],
    [150, [0, 50, 100, 150]],
    [689, [0, 200, 400, 600, 800]],
    [1000, [0, 200, 400, 600, 800, 1000]],
    [69075, [0, 20000, 40000, 60000, 80000]],
  ])('上限 %i → %j', (upperBound, expected) => {
    expect(computeNiceTicks(trial(upperBound))).toEqual(expected)
  })

  it('末尾の目盛りは上限以上で、目盛りは 6 本以下', () => {
    for (let ub = 1; ub <= 5000; ub++) {
      const ticks = computeNiceTicks(trial(ub))
      expect(ticks[0]).toBe(0)
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(ub)
      expect(ticks.length).toBeLessThanOrEqual(6)
      expect(ticks.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('computeXAxisRange', () => {
  it('上限を切りの良い目盛りの末尾まで広げる（p=0.01 → 689 → 800）', () => {
    expect(computeXAxisRange(single(0.01))._unsafeUnwrap()).toEqual({
      upperBound: 800,
      ticks: [0, 200, 400, 600, 800],
    })
  })

  it('include は範囲に必ず含まれる（p=0.5, include=1000 → 1200）', () => {
    const { upperBound } = computeXAxisRange(single(0.5), trial(1000))._unsafeUnwrap()
    expect(upperBound).toBeGreaterThanOrEqual(1200)
  })

  it('曲線の計算エラーはそのまま返す（p=1e-17）', () => {
    expect(computeXAxisRange(single(1e-17))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
  })
})
