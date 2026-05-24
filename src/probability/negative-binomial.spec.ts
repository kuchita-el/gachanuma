import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { err } from 'neverthrow'
import { calculateTrialCountForMultipleSuccess } from './negative-binomial'
import { calculateTrialCount } from './calculator'
import { formatDomainError, parseInputOrErr } from './domain-error'
import { validTargetCountSchema } from './probability'

vi.mock('./domain-error', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./domain-error')>()
  return { ...actual, parseInputOrErr: vi.fn(actual.parseInputOrErr) }
})

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
        expect(calculateTrialCountForMultipleSuccess(p, 1, c)._unsafeUnwrap()).toBe(expected)
        expect(calculateTrialCountForMultipleSuccess(p, 1, c)._unsafeUnwrap()).toBe(
          calculateTrialCount(p, c)._unsafeUnwrap(),
        )
      })
    }
  })

  describe('正常系（targetCount >= 2）', () => {
    it('p=0.5, targetCount=2, c=0.9 → 7', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2, 0.9)._unsafeUnwrap()).toBe(7)
    })

    it('p=0.5, targetCount=10, c=0.9 → 26（厳密値）', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 10, 0.9)._unsafeUnwrap()).toBe(26)
    })

    it('p=0.1, targetCount=5, c=0.9 → 78（厳密値）', () => {
      expect(calculateTrialCountForMultipleSuccess(0.1, 5, 0.9)._unsafeUnwrap()).toBe(78)
    })

    it('p=0.5, targetCount=100, c=0.9 → 218（厳密値、正規近似 k≈218 と整合）', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 100, 0.9)._unsafeUnwrap()).toBe(218)
    })

    it('confidence 省略時は DEFAULT_CONFIDENCE=0.9 が適用される', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2)._unsafeUnwrap()).toBe(7)
    })
  })

  describe('単調性', () => {
    it('targetCount 増加に対し試行回数は単調非減少', () => {
      const ns = [1, 2, 5, 10, 20].map(t =>
        calculateTrialCountForMultipleSuccess(0.5, t, 0.9)._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountForMultipleSuccess(0.5, 3, c)._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('バリデーション（targetCount）', () => {
    it('targetCount=0 は InvalidInput、文言に「目標成功回数」を含む', () => {
      const result = calculateTrialCountForMultipleSuccess(0.5, 0, 0.9)
      expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
      expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/目標成功回数/)
    })

    it('targetCount=-1 は InvalidInput を err 返却', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, -1, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('targetCount=1.5 は InvalidInput、文言に「整数」を含む', () => {
      const result = calculateTrialCountForMultipleSuccess(0.5, 1.5, 0.9)
      expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/整数/)
    })

    it('targetCount=101 は InvalidInput、文言に「100以下」を含む', () => {
      const result = calculateTrialCountForMultipleSuccess(0.5, 101, 0.9)
      expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/100以下/)
    })

    it('targetCount=NaN は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, NaN, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('targetCount=Infinity は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, Infinity, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('バリデーション（successRate, confidence）', () => {
    it('successRate=0 は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0, 2, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('successRate=1 は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(1, 2, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('successRate=NaN は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(NaN, 2, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('successRate=Infinity は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(Infinity, 2, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('confidence=0 は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2, 0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('confidence=1 は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2, 1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('confidence=NaN は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2, NaN)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('confidence=Infinity は InvalidInput', () => {
      expect(calculateTrialCountForMultipleSuccess(0.5, 2, Infinity)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, targetCount=1 は NonFiniteResult（既存 calculateTrialCount 経由）', () => {
      const result = calculateTrialCountForMultipleSuccess(1e-17, 1, 0.9)
      expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('p=1e-17, targetCount=2 では反復上限超過で IterationLimitExceeded', () => {
      const result = calculateTrialCountForMultipleSuccess(1e-17, 2, 0.9)
      expect(result._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })
  })
})

describe('calculateTrialCountForMultipleSuccess (mock 経路)', () => {
  it('成功時は ok を返す', () => {
    expect(calculateTrialCountForMultipleSuccess(0.5, 2, 0.9)._unsafeUnwrap()).toBe(7)
  })

  it('targetCount=1 で tryCalculateTrialCount と同等の挙動（既存 API への帰着）', () => {
    expect(calculateTrialCountForMultipleSuccess(0.5, 1)._unsafeUnwrap()).toBe(4)
  })

  it('targetCount=0 は err、文言に「目標成功回数」を含む', () => {
    const r = calculateTrialCountForMultipleSuccess(0.5, 0, 0.9)
    expect(r.isErr()).toBe(true)
    expect(formatDomainError(r._unsafeUnwrapErr())).toMatch(/目標成功回数/)
  })

  it('successRate=0 は err、文言に「成功率」を含む', () => {
    const r = calculateTrialCountForMultipleSuccess(0, 2, 0.9)
    expect(formatDomainError(r._unsafeUnwrapErr())).toMatch(/成功率/)
  })

  it('浮動小数点境界 p=1e-17, targetCount=1 は err（NonFiniteResult 経由）', () => {
    expect(calculateTrialCountForMultipleSuccess(1e-17, 1, 0.9).isErr()).toBe(true)
  })

  it('複数 issue を持つバリデーション失敗は全 issue.message を \\n 区切りで結合', () => {
    vi.mocked(parseInputOrErr).mockReturnValueOnce(
      err({ kind: 'InvalidInput', issues: [{ message: 'M1' }, { message: 'M2' }] }),
    )
    const r = calculateTrialCountForMultipleSuccess(0.1, 5)
    expect(r.isErr()).toBe(true)
    const message = formatDomainError(r._unsafeUnwrapErr())
    expect(message).toContain('M1')
    expect(message).toContain('M2')
    expect(message.split('\n').length).toBeGreaterThanOrEqual(2)
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
