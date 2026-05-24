import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { err } from 'neverthrow'
import {
  calculateCumulativeSuccessProbability,
  calculateTrialCount,
} from './calculator'
import { formatDomainError, parseInputOrErr } from './domain-error'
import {
  DEFAULT_CONFIDENCE,
  percentToRatio,
  ratioToPercent,
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTrialCountSchema,
} from './probability'

// 境界ヘルパ `parseInputOrErr` のみ spy 化することで、valibot 全体への影響を回避し
// テスト順序による発火タイミングのブレを排除する。schema 単体 spec は actual の v.parse を直接使う。
vi.mock('./domain-error', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./domain-error')>()
  return { ...actual, parseInputOrErr: vi.fn(actual.parseInputOrErr) }
})

describe('calculateTrialCount', () => {
  describe('正常系', () => {
    it('50%の成功率の場合、4回の試行が必要', () => {
      expect(calculateTrialCount(0.5)._unsafeUnwrap()).toBe(4)
    })

    it('10%の成功率の場合、22回の試行が必要', () => {
      expect(calculateTrialCount(0.1)._unsafeUnwrap()).toBe(22)
    })

    it('90%の成功率の場合、1回の試行が必要', () => {
      expect(calculateTrialCount(0.9)._unsafeUnwrap()).toBe(1)
    })

    it('1%の成功率の場合、230回の試行が必要', () => {
      expect(calculateTrialCount(0.01)._unsafeUnwrap()).toBe(230)
    })

    it('99%の成功率の場合、1回の試行が必要', () => {
      expect(calculateTrialCount(0.99)._unsafeUnwrap()).toBe(1)
    })

    it('小数点を含む成功率でも計算可能 (0.123)', () => {
      const value = calculateTrialCount(0.123)._unsafeUnwrap()
      expect(value).toBeGreaterThan(0)
      expect(Number.isFinite(value)).toBe(true)
    })
  })

  describe('エッジケース: 0% (境界値)', () => {
    it('0は InvalidInput を err 返却', () => {
      const result = calculateTrialCount(0)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('非常に小さい正の値 (0.0001) は計算可能', () => {
      const value = calculateTrialCount(0.0001)._unsafeUnwrap()
      expect(value).toBeGreaterThan(0)
      expect(Number.isFinite(value)).toBe(true)
    })

    it('負の値は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(-0.1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('エッジケース: 100% (境界値)', () => {
    it('1は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('非常に大きい値 (0.9999) は計算可能', () => {
      const value = calculateTrialCount(0.9999)._unsafeUnwrap()
      expect(value).toBe(1)
    })

    it('1より大きい値は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(1.1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('異常系', () => {
    it('範囲外の値 (2.0) は err 返却', () => {
      expect(calculateTrialCount(2.0).isErr()).toBe(true)
    })

    it('範囲外の値 (-1.0) は err 返却', () => {
      expect(calculateTrialCount(-1.0).isErr()).toBe(true)
    })

    it('成功率 NaN は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(NaN)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率 Infinity は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(Infinity)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率 -Infinity は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(-Infinity)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('信頼度 NaN は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0.5, NaN)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('信頼度 Infinity は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0.5, Infinity)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('浮動小数点境界（C-1: 非有限値ガード）', () => {
    it('成功率 1e-17（IEEE754 で 1-p=1 に丸まる）は NonFiniteResult を err 返却', () => {
      const error = calculateTrialCount(1e-17)._unsafeUnwrapErr()
      expect(error.kind).toBe('NonFiniteResult')
      expect(formatDomainError(error)).toMatch(/極端に小さい/)
    })

    it('成功率 Number.MIN_VALUE は NonFiniteResult を err 返却', () => {
      expect(calculateTrialCount(Number.MIN_VALUE)._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('NonFiniteResult は InvalidInput とは区別される', () => {
      const error = calculateTrialCount(5e-17)._unsafeUnwrapErr()
      expect(error.kind).toBe('NonFiniteResult')
      expect(error.kind).not.toBe('InvalidInput')
    })

    it('実用域の極小値 1e-10 は計算可能で有限', () => {
      const value = calculateTrialCount(1e-10)._unsafeUnwrap()
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    })
  })

  describe('戻り値の型チェック', () => {
    it('結果は数値型である', () => {
      expect(typeof calculateTrialCount(0.5)._unsafeUnwrap()).toBe('number')
    })

    it('結果は整数である', () => {
      expect(Number.isInteger(calculateTrialCount(0.5)._unsafeUnwrap())).toBe(true)
    })

    it('結果は有限値である', () => {
      expect(Number.isFinite(calculateTrialCount(0.5)._unsafeUnwrap())).toBe(true)
    })

    it('結果は正の値である', () => {
      expect(calculateTrialCount(0.5)._unsafeUnwrap()).toBeGreaterThan(0)
    })
  })

  describe('信頼度引数明示', () => {
    it('信頼度省略は DEFAULT_CONFIDENCE 明示と等価', () => {
      expect(calculateTrialCount(0.5)._unsafeUnwrap()).toBe(
        calculateTrialCount(0.5, DEFAULT_CONFIDENCE)._unsafeUnwrap(),
      )
      expect(calculateTrialCount(0.1)._unsafeUnwrap()).toBe(
        calculateTrialCount(0.1, DEFAULT_CONFIDENCE)._unsafeUnwrap(),
      )
    })

    it('DEFAULT_CONFIDENCE は 0.9', () => {
      expect(DEFAULT_CONFIDENCE).toBe(0.9)
    })

    it('成功率0.5・信頼度0.9で4回（デフォルト値と一致）', () => {
      expect(calculateTrialCount(0.5, 0.9)._unsafeUnwrap()).toBe(4)
    })

    it('成功率0.5・信頼度0.99で7回（信頼度上昇）', () => {
      expect(calculateTrialCount(0.5, 0.99)._unsafeUnwrap()).toBe(7)
    })

    it('成功率0.5・信頼度0.5で1回（信頼度下降）', () => {
      expect(calculateTrialCount(0.5, 0.5)._unsafeUnwrap()).toBe(1)
    })

    it('成功率0.1・信頼度0.9で22回（既存値との一致）', () => {
      expect(calculateTrialCount(0.1, 0.9)._unsafeUnwrap()).toBe(22)
    })

    it('信頼度を上げると試行回数は単調非減少（成功率0.3固定）', () => {
      const lowConf = calculateTrialCount(0.3, 0.5)._unsafeUnwrap()
      const midConf = calculateTrialCount(0.3, 0.9)._unsafeUnwrap()
      const highConf = calculateTrialCount(0.3, 0.99)._unsafeUnwrap()
      expect(midConf).toBeGreaterThanOrEqual(lowConf)
      expect(highConf).toBeGreaterThanOrEqual(midConf)
    })
  })

  describe('信頼度バリデーション', () => {
    it('信頼度0は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0.5, 0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('信頼度1は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0.5, 1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('信頼度-0.1は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0.5, -0.1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('信頼度1.5は InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0.5, 1.5)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率0・信頼度0.9で（成功率側の）InvalidInput を err 返却', () => {
      expect(calculateTrialCount(0, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })
})

describe('calculateCumulativeSuccessProbability', () => {
  describe('正常系', () => {
    it('成功率0.5・試行回数4で0.9375を返す', () => {
      expect(calculateCumulativeSuccessProbability(0.5, 4)._unsafeUnwrap()).toBeCloseTo(0.9375)
    })

    it('成功率0.5・試行回数1で0.5を返す', () => {
      expect(calculateCumulativeSuccessProbability(0.5, 1)._unsafeUnwrap()).toBeCloseTo(0.5)
    })

    it('成功率0.1・試行回数22で0.9以上を返す', () => {
      expect(calculateCumulativeSuccessProbability(0.1, 22)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
    })

    it('戻り値は number 型かつ 0 < r < 1 を満たす', () => {
      const value = calculateCumulativeSuccessProbability(0.3, 5)._unsafeUnwrap()
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThan(1)
    })

    it('戻り値は有限値', () => {
      expect(Number.isFinite(calculateCumulativeSuccessProbability(0.5, 10)._unsafeUnwrap())).toBe(true)
    })
  })

  describe('バリデーション', () => {
    it('成功率NaNは InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(NaN, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率Infinityは InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(Infinity, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('試行回数NaNは InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(0.5, NaN)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('試行回数Infinityは InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(0.5, Infinity)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率0は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(0, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率1は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(1, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率-0.1は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(-0.1, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('成功率1.5は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(1.5, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('試行回数0は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(0.5, 0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('試行回数-1は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(0.5, -1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('試行回数1.5（小数）は InvalidInput を err 返却', () => {
      expect(calculateCumulativeSuccessProbability(0.5, 1.5)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('浮動小数点境界', () => {
    it('成功率1e-17（極小）・試行回数1で ratio が 0 に飽和し NonFiniteResult', () => {
      expect(calculateCumulativeSuccessProbability(1e-17, 1)._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })
  })
})

describe('calculateTrialCount (mock 経路)', () => {
  it('成功時は ok の Result を返す', () => {
    const result = calculateTrialCount(0.5)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(4)
  })

  it('信頼度引数も透過する', () => {
    expect(calculateTrialCount(0.5, 0.99)._unsafeUnwrap()).toBe(7)
  })

  it('値域外の成功率は err、formatDomainError が「成功率」を含む文言を返す', () => {
    const result = calculateTrialCount(0)
    expect(result.isErr()).toBe(true)
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/成功率/)
  })

  it('値域外の信頼度は err、formatDomainError が「信頼度」を含む文言を返す', () => {
    const result = calculateTrialCount(0.5, 1)
    expect(result.isErr()).toBe(true)
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/信頼度/)
  })

  it('浮動小数点境界（1e-17）は NonFiniteResult を err、文言に「極端に小さい」を含む', () => {
    const result = calculateTrialCount(1e-17)
    expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/極端に小さい/)
  })

  it('成功率 NaN は InvalidInput を err 返却', () => {
    expect(calculateTrialCount(NaN)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('複数 issue を持つバリデーション失敗は全 issue.message を \\n 区切りで結合', () => {
    vi.mocked(parseInputOrErr).mockReturnValueOnce(
      err({ kind: 'InvalidInput', issues: [{ message: 'M1' }, { message: 'M2' }] }),
    )
    const result = calculateTrialCount(0.5)
    expect(result.isErr()).toBe(true)
    const message = formatDomainError(result._unsafeUnwrapErr())
    expect(message).toContain('M1')
    expect(message).toContain('M2')
    expect(message.split('\n').length).toBeGreaterThanOrEqual(2)
  })
})

describe('calculateCumulativeSuccessProbability (mock 経路)', () => {
  it('成功時は ok の Result を返し、累積確率 ratio（0.5・4 → 0.9375）', () => {
    expect(calculateCumulativeSuccessProbability(0.5, 4)._unsafeUnwrap()).toBeCloseTo(0.9375)
  })

  it('信頼度90%以上を満たす境界（0.1・22）で 0.9 以上の ratio を返す', () => {
    expect(calculateCumulativeSuccessProbability(0.1, 22)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
  })

  it('成功率 0 は err、文言に「成功率」を含む', () => {
    const result = calculateCumulativeSuccessProbability(0, 4)
    expect(result.isErr()).toBe(true)
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/成功率/)
  })

  it('成功率 1 は err、文言に「成功率」を含む', () => {
    const result = calculateCumulativeSuccessProbability(1, 4)
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/成功率/)
  })

  it('試行回数 0 は err、文言に「試行回数」を含む', () => {
    const result = calculateCumulativeSuccessProbability(0.5, 0)
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/試行回数/)
  })

  it('試行回数 1.5（非整数）は err、文言に「試行回数」を含む', () => {
    const result = calculateCumulativeSuccessProbability(0.5, 1.5)
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/試行回数/)
  })

  it('試行回数 -1 は err 返却', () => {
    expect(calculateCumulativeSuccessProbability(0.5, -1).isErr()).toBe(true)
  })

  it('成功率 NaN は InvalidInput を err 返却', () => {
    expect(calculateCumulativeSuccessProbability(NaN, 4)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('試行回数 Infinity は err 返却', () => {
    expect(calculateCumulativeSuccessProbability(0.5, Infinity).isErr()).toBe(true)
  })

  it('成功率1e-17は NonFiniteResult を err、文言に「極端に小さい」を含む', () => {
    const result = calculateCumulativeSuccessProbability(1e-17, 1)
    expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/極端に小さい/)
  })

  it('複数 issue を持つバリデーション失敗は全 issue.message を \\n 区切りで結合', () => {
    vi.mocked(parseInputOrErr).mockReturnValueOnce(
      err({ kind: 'InvalidInput', issues: [{ message: 'M1' }, { message: 'M2' }] }),
    )
    const result = calculateCumulativeSuccessProbability(0.5, 4)
    expect(result.isErr()).toBe(true)
    const message = formatDomainError(result._unsafeUnwrapErr())
    expect(message).toContain('M1')
    expect(message).toContain('M2')
    expect(message.split('\n').length).toBeGreaterThanOrEqual(2)
  })
})

describe('calculateTrialCount と calculateCumulativeSuccessProbability の往復整合', () => {
  it('成功率0.5・信頼度0.9で求めた試行回数で累積確率が0.9以上', () => {
    const n = calculateTrialCount(0.5, 0.9)._unsafeUnwrap()
    expect(calculateCumulativeSuccessProbability(0.5, n)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
  })

  it('成功率0.3・信頼度0.99で求めた試行回数で累積確率が0.99以上', () => {
    const n = calculateTrialCount(0.3, 0.99)._unsafeUnwrap()
    expect(calculateCumulativeSuccessProbability(0.3, n)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.99)
  })

  it('成功率0.01・信頼度0.9で求めた試行回数で累積確率が0.9以上', () => {
    const n = calculateTrialCount(0.01, 0.9)._unsafeUnwrap()
    expect(calculateCumulativeSuccessProbability(0.01, n)._unsafeUnwrap()).toBeGreaterThanOrEqual(0.9)
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
