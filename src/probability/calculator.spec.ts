import { describe, it, expect } from 'vitest'
import { calculateTrialCount, calculateTrialCountFromPercent } from './calculator'

describe('calculateTrialCount', () => {
  describe('正常系', () => {
    it('50%の成功率の場合、4回の試行が必要', () => {
      const result = calculateTrialCount(0.5)
      expect(result).toBe(4)
    })

    it('10%の成功率の場合、22回の試行が必要', () => {
      const result = calculateTrialCount(0.1)
      expect(result).toBe(22)
    })

    it('90%の成功率の場合、1回の試行が必要', () => {
      const result = calculateTrialCount(0.9)
      expect(result).toBe(1)
    })

    it('1%の成功率の場合、230回の試行が必要', () => {
      const result = calculateTrialCount(0.01)
      expect(result).toBe(230)
    })

    it('99%の成功率の場合、1回の試行が必要', () => {
      const result = calculateTrialCount(0.99)
      expect(result).toBe(1)
    })

    it('小数点を含む成功率でも計算可能 (0.123)', () => {
      const result = calculateTrialCount(0.123)
      expect(result).toBeGreaterThan(0)
      expect(Number.isFinite(result)).toBe(true)
    })
  })

  describe('エッジケース: 0% (境界値)', () => {
    it('0の場合ValiErrorをスローする', () => {
      expect(() => calculateTrialCount(0)).toThrow()
    })

    it('非常に小さい正の値 (0.0001) は計算可能', () => {
      const result = calculateTrialCount(0.0001)
      expect(result).toBeGreaterThan(0)
      expect(Number.isFinite(result)).toBe(true)
    })

    it('負の値の場合ValiErrorをスローする', () => {
      expect(() => calculateTrialCount(-0.1)).toThrow()
    })
  })

  describe('エッジケース: 100% (境界値)', () => {
    it('1の場合ValiErrorをスローする', () => {
      expect(() => calculateTrialCount(1)).toThrow()
    })

    it('非常に大きい値 (0.9999) は計算可能', () => {
      const result = calculateTrialCount(0.9999)
      expect(result).toBe(1)
      expect(Number.isFinite(result)).toBe(true)
    })

    it('1より大きい値の場合ValiErrorをスローする', () => {
      expect(() => calculateTrialCount(1.1)).toThrow()
    })
  })

  describe('異常系', () => {
    it('範囲外の値 (2.0) の場合エラーをスローする', () => {
      expect(() => calculateTrialCount(2.0)).toThrow()
    })

    it('範囲外の値 (-1.0) の場合エラーをスローする', () => {
      expect(() => calculateTrialCount(-1.0)).toThrow()
    })
  })

  describe('戻り値の型チェック', () => {
    it('結果は数値型である', () => {
      const result = calculateTrialCount(0.5)
      expect(typeof result).toBe('number')
    })

    it('結果は整数である', () => {
      const result = calculateTrialCount(0.5)
      expect(Number.isInteger(result)).toBe(true)
    })

    it('結果は有限値である', () => {
      const result = calculateTrialCount(0.5)
      expect(Number.isFinite(result)).toBe(true)
    })

    it('結果は正の値である', () => {
      const result = calculateTrialCount(0.5)
      expect(result).toBeGreaterThan(0)
    })
  })
})

describe('calculateTrialCountFromPercent', () => {
  describe('正常系', () => {
    it('50%の成功率の場合、4回の試行が必要', () => {
      const result = calculateTrialCountFromPercent(50)
      expect(result).toBe(4)
    })

    it('10%の成功率の場合、22回の試行が必要', () => {
      const result = calculateTrialCountFromPercent(10)
      expect(result).toBe(22)
    })

    it('1%の成功率の場合、230回の試行が必要', () => {
      const result = calculateTrialCountFromPercent(1)
      expect(result).toBe(230)
    })
  })

  describe('エッジケース: 0%', () => {
    it('0%の場合ValiErrorをスローする', () => {
      expect(() => calculateTrialCountFromPercent(0)).toThrow()
    })
  })

  describe('エッジケース: 100%', () => {
    it('100%の場合ValiErrorをスローする', () => {
      expect(() => calculateTrialCountFromPercent(100)).toThrow()
    })
  })
})
