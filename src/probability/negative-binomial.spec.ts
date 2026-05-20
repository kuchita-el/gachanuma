import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  calculateTrialCountForMultipleSuccess,
  tryCalculateTrialCountForMultipleSuccess,
} from './negative-binomial'
import { CalculationError, calculateTrialCount } from './calculator'
import { validTargetCountSchema } from './probability'

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
        expect(calculateTrialCountForMultipleSuccess(p, 1, c)).toBe(expected)
        expect(calculateTrialCountForMultipleSuccess(p, 1, c)).toBe(calculateTrialCount(p, c))
      })
    }
  })

  describe('正常系（targetCount >= 2）', () => {
    it('p=0.5, targetCount=2, c=0.9 → 7', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2, 0.9)).toBe(7)
    })

    it('p=0.5, targetCount=10, c=0.9 → 中域の値（5 < n < 100）', () => {
      const n = calculateTrialCountForMultipleSuccess(0.5, 10, 0.9)
      expect(n).toBeGreaterThan(5)
      expect(n).toBeLessThan(100)
    })

    it('p=0.1, targetCount=5, c=0.9 → 中域の値（30 < n < 200）', () => {
      const n = calculateTrialCountForMultipleSuccess(0.1, 5, 0.9)
      expect(n).toBeGreaterThan(30)
      expect(n).toBeLessThan(200)
    })

    it('p=0.5, targetCount=100, c=0.9 → 100 ≤ n ≤ 500（境界）', () => {
      const n = calculateTrialCountForMultipleSuccess(0.5, 100, 0.9)
      expect(n).toBeGreaterThanOrEqual(100)
      expect(n).toBeLessThanOrEqual(500)
    })
  })

  describe('単調性', () => {
    it('targetCount 増加に対し試行回数は単調非減少', () => {
      const ns = [1, 2, 5, 10, 20].map(t => calculateTrialCountForMultipleSuccess(0.5, t, 0.9))
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountForMultipleSuccess(0.5, 3, c),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('バリデーション（targetCount）', () => {
    it('targetCount=0 で ValiError、メッセージに「目標成功回数」を含む', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, 0, 0.9)).toThrow(/目標成功回数/)
    })

    it('targetCount=-1 で ValiError をスロー', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, -1, 0.9)).toThrow(v.ValiError)
    })

    it('targetCount=1.5 で ValiError、メッセージに「整数」を含む', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, 1.5, 0.9)).toThrow(/整数/)
    })

    it('targetCount=101 で ValiError、メッセージに「100以下」を含む', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, 101, 0.9)).toThrow(/100以下/)
    })

    it('targetCount=NaN で ValiError をスロー', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, NaN, 0.9)).toThrow(v.ValiError)
    })

    it('targetCount=Infinity で ValiError をスロー', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, Infinity, 0.9)).toThrow(v.ValiError)
    })
  })

  describe('バリデーション（successRate, confidence）', () => {
    it('successRate=0 で ValiError', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0, 2, 0.9)).toThrow(v.ValiError)
    })

    it('successRate=1 で ValiError', () => {
      expect(() => calculateTrialCountForMultipleSuccess(1, 2, 0.9)).toThrow(v.ValiError)
    })

    it('successRate=NaN で ValiError', () => {
      expect(() => calculateTrialCountForMultipleSuccess(NaN, 2, 0.9)).toThrow(v.ValiError)
    })

    it('confidence=0 で ValiError', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, 2, 0)).toThrow(v.ValiError)
    })

    it('confidence=1 で ValiError', () => {
      expect(() => calculateTrialCountForMultipleSuccess(0.5, 2, 1)).toThrow(v.ValiError)
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, targetCount=1 で CalculationError（既存 calculateTrialCount 経由）', () => {
      expect(() => calculateTrialCountForMultipleSuccess(1e-17, 1, 0.9)).toThrow(CalculationError)
    })

    it('p=1e-17, targetCount=2 では反復上限超過で CalculationError', () => {
      expect(() => calculateTrialCountForMultipleSuccess(1e-17, 2, 0.9)).toThrow(CalculationError)
    })
  })
})

describe('tryCalculateTrialCountForMultipleSuccess（Result 型ラッパ）', () => {
  it('成功時は ok:true と value', () => {
    const r = tryCalculateTrialCountForMultipleSuccess(0.5, 2, 0.9)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe(7)
    }
  })

  it('targetCount=1 で tryCalculateTrialCount と同等の挙動（既存 API への帰着）', () => {
    const r = tryCalculateTrialCountForMultipleSuccess(0.5, 1)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe(4)
    }
  })

  it('targetCount=0 は ok:false、message に「目標成功回数」を含む', () => {
    const r = tryCalculateTrialCountForMultipleSuccess(0.5, 0, 0.9)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/目標成功回数/)
    }
  })

  it('successRate=0 は ok:false、message に「成功率」を含む', () => {
    const r = tryCalculateTrialCountForMultipleSuccess(0, 2, 0.9)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/成功率/)
    }
  })

  it('浮動小数点境界 p=1e-17, targetCount=1 は ok:false（CalculationError 経由）', () => {
    const r = tryCalculateTrialCountForMultipleSuccess(1e-17, 1, 0.9)
    expect(r.ok).toBe(false)
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
