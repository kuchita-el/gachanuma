import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import {
  CalculationError,
  calculateCumulativeSuccessProbability,
  calculateTrialCount,
  tryCalculateCumulativeSuccessProbability,
  tryCalculateTrialCount,
} from './calculator'
import {
  DEFAULT_CONFIDENCE,
  percentToRatio,
  ratioToPercent,
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './probability'

vi.mock('valibot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('valibot')>()
  return { ...actual, parse: vi.fn(actual.parse) }
})

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

    it('成功率 NaN の場合 ValiError をスローする', () => {
      expect(() => calculateTrialCount(NaN)).toThrow(v.ValiError)
    })

    it('成功率 Infinity の場合 ValiError をスローする', () => {
      expect(() => calculateTrialCount(Infinity)).toThrow(v.ValiError)
    })

    it('成功率 -Infinity の場合 ValiError をスローする', () => {
      expect(() => calculateTrialCount(-Infinity)).toThrow(v.ValiError)
    })

    it('信頼度 NaN の場合 ValiError をスローする', () => {
      expect(() => calculateTrialCount(0.5, NaN)).toThrow(v.ValiError)
    })

    it('信頼度 Infinity の場合 ValiError をスローする', () => {
      expect(() => calculateTrialCount(0.5, Infinity)).toThrow(v.ValiError)
    })
  })

  describe('浮動小数点境界（C-1: 非有限値ガード）', () => {
    it('成功率 1e-17（IEEE754 で 1-p=1 に丸まる）の場合、CalculationError をスローする', () => {
      expect(() => calculateTrialCount(1e-17)).toThrow(CalculationError)
      expect(() => calculateTrialCount(1e-17)).toThrow(/極端に小さい/)
    })

    it('成功率 Number.MIN_VALUE の場合、CalculationError をスローする', () => {
      expect(() => calculateTrialCount(Number.MIN_VALUE)).toThrow(CalculationError)
    })

    it('CalculationError は ValiError とは区別される', () => {
      expect(() => calculateTrialCount(5e-17)).toThrow(CalculationError)
      expect(() => calculateTrialCount(5e-17)).not.toThrow(v.ValiError)
    })

    it('実用域の極小値 1e-10 は計算可能で有限', () => {
      const result = calculateTrialCount(1e-10)
      expect(Number.isFinite(result)).toBe(true)
      expect(result).toBeGreaterThan(0)
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

  describe('信頼度引数明示', () => {
    it('信頼度省略は DEFAULT_CONFIDENCE 明示と等価', () => {
      expect(calculateTrialCount(0.5)).toBe(calculateTrialCount(0.5, DEFAULT_CONFIDENCE))
      expect(calculateTrialCount(0.1)).toBe(calculateTrialCount(0.1, DEFAULT_CONFIDENCE))
    })

    it('DEFAULT_CONFIDENCE は 0.9', () => {
      expect(DEFAULT_CONFIDENCE).toBe(0.9)
    })

    it('成功率0.5・信頼度0.9で4回（デフォルト値と一致）', () => {
      expect(calculateTrialCount(0.5, 0.9)).toBe(4)
    })

    it('成功率0.5・信頼度0.99で7回（信頼度上昇）', () => {
      expect(calculateTrialCount(0.5, 0.99)).toBe(7)
    })

    it('成功率0.5・信頼度0.5で1回（信頼度下降）', () => {
      expect(calculateTrialCount(0.5, 0.5)).toBe(1)
    })

    it('成功率0.1・信頼度0.9で22回（既存値との一致）', () => {
      expect(calculateTrialCount(0.1, 0.9)).toBe(22)
    })

    it('信頼度を上げると試行回数は単調非減少（成功率0.3固定）', () => {
      const lowConf = calculateTrialCount(0.3, 0.5)
      const midConf = calculateTrialCount(0.3, 0.9)
      const highConf = calculateTrialCount(0.3, 0.99)
      expect(midConf).toBeGreaterThanOrEqual(lowConf)
      expect(highConf).toBeGreaterThanOrEqual(midConf)
    })
  })

  describe('信頼度バリデーション', () => {
    it('信頼度0でValiErrorをスローする', () => {
      expect(() => calculateTrialCount(0.5, 0)).toThrow()
    })

    it('信頼度1でValiErrorをスローする', () => {
      expect(() => calculateTrialCount(0.5, 1)).toThrow()
    })

    it('信頼度-0.1でValiErrorをスローする', () => {
      expect(() => calculateTrialCount(0.5, -0.1)).toThrow()
    })

    it('信頼度1.5でValiErrorをスローする', () => {
      expect(() => calculateTrialCount(0.5, 1.5)).toThrow()
    })

    it('成功率0・信頼度0.9で（成功率側の）ValiErrorをスローする', () => {
      expect(() => calculateTrialCount(0, 0.9)).toThrow()
    })
  })
})

describe('calculateCumulativeSuccessProbability', () => {
  describe('正常系', () => {
    it('成功率0.5・試行回数4で0.9375を返す', () => {
      expect(calculateCumulativeSuccessProbability(0.5, 4)).toBeCloseTo(0.9375)
    })

    it('成功率0.5・試行回数1で0.5を返す', () => {
      expect(calculateCumulativeSuccessProbability(0.5, 1)).toBeCloseTo(0.5)
    })

    it('成功率0.1・試行回数22で0.9以上を返す', () => {
      expect(calculateCumulativeSuccessProbability(0.1, 22)).toBeGreaterThanOrEqual(0.9)
    })

    it('戻り値は number 型かつ 0 < r < 1 を満たす', () => {
      const result = calculateCumulativeSuccessProbability(0.3, 5)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })

    it('戻り値は有限値', () => {
      const result = calculateCumulativeSuccessProbability(0.5, 10)
      expect(Number.isFinite(result)).toBe(true)
    })
  })

  describe('バリデーション', () => {
    it('成功率NaNでValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(NaN, 4)).toThrow(v.ValiError)
    })

    it('成功率InfinityでValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(Infinity, 4)).toThrow(v.ValiError)
    })

    it('試行回数NaNでValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(0.5, NaN)).toThrow(v.ValiError)
    })

    it('試行回数InfinityでValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(0.5, Infinity)).toThrow(v.ValiError)
    })

    it('成功率0でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(0, 4)).toThrow()
    })

    it('成功率1でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(1, 4)).toThrow()
    })

    it('成功率-0.1でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(-0.1, 4)).toThrow()
    })

    it('成功率1.5でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(1.5, 4)).toThrow()
    })

    it('試行回数0でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(0.5, 0)).toThrow()
    })

    it('試行回数-1でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(0.5, -1)).toThrow()
    })

    it('試行回数1.5（小数）でValiErrorをスローする', () => {
      expect(() => calculateCumulativeSuccessProbability(0.5, 1.5)).toThrow()
    })
  })

  describe('浮動小数点境界', () => {
    it('成功率1e-17（極小）・試行回数1で ratio が 0 に飽和し CalculationError', () => {
      expect(() => calculateCumulativeSuccessProbability(1e-17, 1)).toThrow(CalculationError)
    })
  })
})

describe('tryCalculateTrialCount（Result 型ラッパ）', () => {
  it('成功時は ok:true と value を返す', () => {
    const result = tryCalculateTrialCount(0.5)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(4)
    }
  })

  it('信頼度引数も透過する', () => {
    const result = tryCalculateTrialCount(0.5, 0.99)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(7)
    }
  })

  it('値域外の成功率は ok:false と ValiError メッセージを返す', () => {
    const result = tryCalculateTrialCount(0)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/成功率/)
    }
  })

  it('値域外の信頼度は ok:false と ValiError メッセージを返す', () => {
    const result = tryCalculateTrialCount(0.5, 1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/信頼度/)
    }
  })

  it('浮動小数点境界（1e-17）は ok:false と CalculationError メッセージを返す', () => {
    const result = tryCalculateTrialCount(1e-17)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/極端に小さい/)
    }
  })

  it('成功率 NaN は ok:false（ValiError 経由）を返す', () => {
    const result = tryCalculateTrialCount(NaN)
    expect(result.ok).toBe(false)
  })

  it('複数 issue を持つ ValiError は全 issue.message を \\n 区切りで結合した message を返す', () => {
    const issue1 = {
      kind: 'validation',
      type: 'custom',
      input: 0.5,
      expected: null,
      received: '0.5',
      message: 'M1',
    }
    const issue2 = {
      kind: 'validation',
      type: 'custom',
      input: 0.5,
      expected: null,
      received: '0.5',
      message: 'M2',
    }
    vi.mocked(v.parse).mockImplementationOnce(() => {
      throw new v.ValiError([issue1, issue2] as never)
    })
    const result = tryCalculateTrialCount(0.5)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('M1')
      expect(result.message).toContain('M2')
      expect(result.message.split('\n').length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('tryCalculateCumulativeSuccessProbability（Result 型ラッパ）', () => {
  it('成功時は ok:true と累積確率 ratio を返す（0.5・4 → 0.9375）', () => {
    const result = tryCalculateCumulativeSuccessProbability(0.5, 4)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.9375)
    }
  })

  it('信頼度90%以上を満たす境界（0.1・22）で 0.9 以上の ratio を返す', () => {
    const result = tryCalculateCumulativeSuccessProbability(0.1, 22)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('成功率 0 は ok:false でメッセージに「成功率」を含む', () => {
    const result = tryCalculateCumulativeSuccessProbability(0, 4)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/成功率/)
    }
  })

  it('成功率 1 は ok:false でメッセージに「成功率」を含む', () => {
    const result = tryCalculateCumulativeSuccessProbability(1, 4)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/成功率/)
    }
  })

  it('試行回数 0 は ok:false でメッセージに「試行回数」を含む', () => {
    const result = tryCalculateCumulativeSuccessProbability(0.5, 0)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/試行回数/)
    }
  })

  it('試行回数 1.5（非整数）は ok:false でメッセージに「試行回数」を含む', () => {
    const result = tryCalculateCumulativeSuccessProbability(0.5, 1.5)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/試行回数/)
    }
  })

  it('試行回数 -1 は ok:false を返す', () => {
    const result = tryCalculateCumulativeSuccessProbability(0.5, -1)
    expect(result.ok).toBe(false)
  })

  it('成功率 NaN は ok:false（ValiError 経由）を返す', () => {
    const result = tryCalculateCumulativeSuccessProbability(NaN, 4)
    expect(result.ok).toBe(false)
  })

  it('試行回数 Infinity は ok:false を返す', () => {
    const result = tryCalculateCumulativeSuccessProbability(0.5, Infinity)
    expect(result.ok).toBe(false)
  })

  it('成功率1e-17は CalculationError 経由で ok:false を返し、メッセージに「極端に小さい」を含む', () => {
    const result = tryCalculateCumulativeSuccessProbability(1e-17, 1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/極端に小さい/)
    }
  })

  it('複数 issue を持つ ValiError は全 issue.message を \\n 区切りで結合した message を返す', () => {
    const issue1 = {
      kind: 'validation',
      type: 'custom',
      input: 0.5,
      expected: null,
      received: '0.5',
      message: 'M1',
    }
    const issue2 = {
      kind: 'validation',
      type: 'custom',
      input: 4,
      expected: null,
      received: '4',
      message: 'M2',
    }
    vi.mocked(v.parse).mockImplementationOnce(() => {
      throw new v.ValiError([issue1, issue2] as never)
    })
    const result = tryCalculateCumulativeSuccessProbability(0.5, 4)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('M1')
      expect(result.message).toContain('M2')
      expect(result.message.split('\n').length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('calculateTrialCount と calculateCumulativeSuccessProbability の往復整合', () => {
  it('成功率0.5・信頼度0.9で求めた試行回数で累積確率が0.9以上', () => {
    const n = calculateTrialCount(0.5, 0.9)
    expect(calculateCumulativeSuccessProbability(0.5, n)).toBeGreaterThanOrEqual(0.9)
  })

  it('成功率0.3・信頼度0.99で求めた試行回数で累積確率が0.99以上', () => {
    const n = calculateTrialCount(0.3, 0.99)
    expect(calculateCumulativeSuccessProbability(0.3, n)).toBeGreaterThanOrEqual(0.99)
  })

  it('成功率0.01・信頼度0.9で求めた試行回数で累積確率が0.9以上', () => {
    const n = calculateTrialCount(0.01, 0.9)
    expect(calculateCumulativeSuccessProbability(0.01, n)).toBeGreaterThanOrEqual(0.9)
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

  it('InfinityはinValiErrorをスローする（整数チェックで弾かれる）', () => {
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
