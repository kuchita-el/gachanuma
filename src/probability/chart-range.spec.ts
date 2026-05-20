import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  computeXAxisUpperBound,
  sampleTrialCounts,
  tryComputeXAxisUpperBound,
} from './chart-range'
import { CalculationError } from './calculator'

describe('computeXAxisUpperBound', () => {
  it('p=0.5 → 11（N99=7, ceil(10.5)=11、AC2 検証）', () => {
    expect(computeXAxisUpperBound(0.5)).toBe(11)
  })

  it('p=0.1 → 66（N99=44, ceil(66)=66）', () => {
    expect(computeXAxisUpperBound(0.1)).toBe(66)
  })

  it('p=0.9 → 3（N99=2, ceil(3)=3、高成功率境界）', () => {
    expect(computeXAxisUpperBound(0.9)).toBe(3)
  })

  it('p=0.01 → 689（N99=459, ceil(688.5)=689）', () => {
    expect(computeXAxisUpperBound(0.01)).toBe(689)
  })

  it('p=0 で ValiError をスロー', () => {
    expect(() => computeXAxisUpperBound(0)).toThrow(v.ValiError)
  })

  it('p=1 で ValiError をスロー', () => {
    expect(() => computeXAxisUpperBound(1)).toThrow(v.ValiError)
  })

  it('p=NaN で ValiError をスロー', () => {
    expect(() => computeXAxisUpperBound(NaN)).toThrow(v.ValiError)
  })

  it('p 極小（1e-17）で CalculationError 経由', () => {
    expect(() => computeXAxisUpperBound(1e-17)).toThrow(CalculationError)
  })
})

describe('sampleTrialCounts', () => {
  it('upperBound <= maxPoints では全整数を返す（upperBound=11 → [1..11]）', () => {
    expect(sampleTrialCounts(11)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('upperBound=1 では [1]', () => {
    expect(sampleTrialCounts(1)).toEqual([1])
  })

  it('upperBound=200, maxPoints=200 では全整数 [1..200]', () => {
    const arr = sampleTrialCounts(200)
    expect(arr).toHaveLength(200)
    expect(arr[0]).toBe(1)
    expect(arr[199]).toBe(200)
  })

  it('upperBound=689, maxPoints=200 では 200 点以下に圧縮、先頭1・末尾689', () => {
    const arr = sampleTrialCounts(689)
    expect(arr.length).toBeLessThanOrEqual(200)
    expect(arr[0]).toBe(1)
    expect(arr[arr.length - 1]).toBe(689)
  })

  it('単調増加であること', () => {
    const arr = sampleTrialCounts(689)
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]!).toBeGreaterThan(arr[i - 1]!)
    }
  })

  it('全要素が整数', () => {
    const arr = sampleTrialCounts(689)
    for (const n of arr) {
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('全要素が 1 以上 upperBound 以下', () => {
    const arr = sampleTrialCounts(689)
    for (const n of arr) {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(689)
    }
  })

  it('maxPoints をカスタムに指定できる', () => {
    const arr = sampleTrialCounts(1000, 10)
    expect(arr.length).toBeLessThanOrEqual(10)
    expect(arr[0]).toBe(1)
    expect(arr[arr.length - 1]).toBe(1000)
  })

  it('upperBound=0 で RangeError をスロー（1以上の整数前提）', () => {
    expect(() => sampleTrialCounts(0)).toThrow(RangeError)
  })

  it('upperBound=-1 で RangeError', () => {
    expect(() => sampleTrialCounts(-1)).toThrow(RangeError)
  })

  it('upperBound=1.5（非整数）で RangeError', () => {
    expect(() => sampleTrialCounts(1.5)).toThrow(RangeError)
  })

  it('maxPoints=1 で RangeError（2以上必須、0除算を防ぐ）', () => {
    expect(() => sampleTrialCounts(100, 1)).toThrow(RangeError)
  })

  it('maxPoints=0 で RangeError', () => {
    expect(() => sampleTrialCounts(100, 0)).toThrow(RangeError)
  })
})

describe('tryComputeXAxisUpperBound（Result 型ラッパ）', () => {
  it('成功時は ok:true と値', () => {
    const r = tryComputeXAxisUpperBound(0.5)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe(11)
    }
  })

  it('p=0 は ok:false、メッセージに「成功率」を含む', () => {
    const r = tryComputeXAxisUpperBound(0)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/成功率/)
    }
  })

  it('p=NaN は ok:false', () => {
    const r = tryComputeXAxisUpperBound(NaN)
    expect(r.ok).toBe(false)
  })

  it('p 極小（1e-17）は ok:false（CalculationError 経由）', () => {
    const r = tryComputeXAxisUpperBound(1e-17)
    expect(r.ok).toBe(false)
  })
})
