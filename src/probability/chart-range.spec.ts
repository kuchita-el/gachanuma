import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  computeXAxisUpperBound,
  sampleTrialCounts,
} from './chart-range'
import { formatDomainError } from './domain-error'
import { validProbabilityRatioSchema, validTrialCountSchema } from './probability'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const trial = (n: number) => v.parse(validTrialCountSchema, n)

describe('computeXAxisUpperBound', () => {
  it('p=0.5 → 11（N99=7, ceil(10.5)=11、AC2 検証）', () => {
    expect(computeXAxisUpperBound(prob(0.5))._unsafeUnwrap()).toBe(11)
  })

  it('p=0.1 → 66（N99=44, ceil(66)=66）', () => {
    expect(computeXAxisUpperBound(prob(0.1))._unsafeUnwrap()).toBe(66)
  })

  it('p=0.9 → 3（N99=2, ceil(3)=3、高成功率境界）', () => {
    expect(computeXAxisUpperBound(prob(0.9))._unsafeUnwrap()).toBe(3)
  })

  it('p=0.01 → 689（N99=459, ceil(688.5)=689）', () => {
    expect(computeXAxisUpperBound(prob(0.01))._unsafeUnwrap()).toBe(689)
  })

  it('p 極小（1e-17）は NonFiniteResult を err 返却（calculator 経由）', () => {
    expect(computeXAxisUpperBound(prob(1e-17))._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
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
