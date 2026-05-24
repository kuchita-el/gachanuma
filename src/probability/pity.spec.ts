import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import {
  calculateTrialCountWithPity,
  tryCalculateTrialCountWithPity,
} from './pity'
import { calculateTrialCount } from './calculator'
import { formatDomainError } from './domain-error'
import { validSlipRateRatioSchema, slipRatePercentageSchema } from './probability'

vi.mock('valibot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('valibot')>()
  return { ...actual, safeParse: vi.fn(actual.safeParse) }
})

describe('calculateTrialCountWithPity', () => {
  describe('正常系（計画書手計算の検証）', () => {
    it('p=0.5, N=10, m=0, c=0.9 → 4（kNoPity < N、k<N 領域で解）', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 0, 0.9)._unsafeUnwrap()).toBe(4)
    })

    it('p=0.01, N=100, m=0, c=0.9 → 100（kNoPity≥N、m=0 で N で確定）', () => {
      expect(calculateTrialCountWithPity(0.01, 100, 0, 0.9)._unsafeUnwrap()).toBe(100)
    })

    it('p=0.01, N=100, m=0.5, c=0.9 → 162（kNoPity≥N、m>1-c の閉形解）', () => {
      expect(calculateTrialCountWithPity(0.01, 100, 0.5, 0.9)._unsafeUnwrap()).toBe(162)
    })

    it('p=0.5, N=10, m=1, c=0.9 → 4（kNoPity<N、m=1 連続性）', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 1, 0.9)._unsafeUnwrap()).toBe(4)
    })

    it('p=0.5, N=4, m=1, c=0.9 → 5（kNoPity==N 境界、m=1 で k=N で P<c、k=N+1）', () => {
      expect(calculateTrialCountWithPity(0.5, 4, 1, 0.9)._unsafeUnwrap()).toBe(5)
    })

    it('confidence 省略時は DEFAULT_CONFIDENCE=0.9 が適用される', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 0)._unsafeUnwrap()).toBe(4)
    })
  })

  describe('境界値', () => {
    it('m=0 の境界（kNoPity≥N で k=N で確定）', () => {
      expect(calculateTrialCountWithPity(0.5, 2, 0, 0.9)._unsafeUnwrap()).toBe(2)
    })

    it('m=1 の連続性（kNoPity が N より大きい場合は k=ceil(log/log)+1）', () => {
      const n = calculateTrialCountWithPity(0.01, 2, 1, 0.9)._unsafeUnwrap()
      expect(n).toBeGreaterThanOrEqual(2)
    })

    it('m ≤ 1-c で k=N が解（m=0.05, c=0.9 で 1-c=0.1）', () => {
      expect(calculateTrialCountWithPity(0.01, 100, 0.05, 0.9)._unsafeUnwrap()).toBe(100)
    })

    it('m が 1-c より僅かに大きい（m=0.11, c=0.9）でも max(N, kCandidate) で N が勝てば k=N', () => {
      expect(calculateTrialCountWithPity(0.01, 100, 0.11, 0.9)._unsafeUnwrap()).toBe(100)
    })

    it('m が大きく k > N になる（p=0.5, N=2, m=0.5, c=0.9）', () => {
      expect(calculateTrialCountWithPity(0.5, 2, 0.5, 0.9)._unsafeUnwrap()).toBe(4)
    })

    it('天井回数 1 の境界（k=1 で必ず天井確定）', () => {
      expect(calculateTrialCountWithPity(0.5, 1, 0, 0.9)._unsafeUnwrap()).toBe(1)
    })
  })

  describe('単調性', () => {
    it('m 増加に対し試行回数は単調非減少', () => {
      const ns = [0, 0.1, 0.3, 0.5, 0.8, 1].map(m =>
        calculateTrialCountWithPity(0.01, 100, m, 0.9)._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountWithPity(0.01, 100, 0.5, c)._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('既存 API との整合', () => {
    it('m=1 + N が十分大きい場合、calculateTrialCount(p, c) と一致（天井効果なし）', () => {
      const expected = calculateTrialCount(0.5, 0.9)._unsafeUnwrap()
      expect(calculateTrialCountWithPity(0.5, 10000, 1, 0.9)._unsafeUnwrap()).toBe(expected)
    })
  })

  describe('バリデーション（successRate）', () => {
    it('p=0 は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0, 10, 0.5, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('p=1 は InvalidInput', () => {
      expect(calculateTrialCountWithPity(1, 10, 0.5, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('p=NaN は InvalidInput', () => {
      expect(calculateTrialCountWithPity(NaN, 10, 0.5, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('バリデーション（pityCount）', () => {
    it('N=0 は InvalidInput、文言に「試行回数」を含む', () => {
      const result = calculateTrialCountWithPity(0.5, 0, 0.5, 0.9)
      expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/試行回数/)
    })

    it('N=-1 は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0.5, -1, 0.5, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('N=1.5（非整数）は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0.5, 1.5, 0.5, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('バリデーション（slipRate）', () => {
    it('m=-0.01 は InvalidInput、文言に「すり抜け率」を含む', () => {
      const result = calculateTrialCountWithPity(0.5, 10, -0.01, 0.9)
      expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/すり抜け率/)
    })

    it('m=1.01 は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 1.01, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('m=NaN は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0.5, 10, NaN, 0.9)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('バリデーション（confidence）', () => {
    it('c=0 は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 0.5, 0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })

    it('c=1 は InvalidInput', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 0.5, 1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, N=100, m=0, c=0.9 では m=0 救済路で N=100 を返す', () => {
      expect(calculateTrialCountWithPity(1e-17, 100, 0, 0.9)._unsafeUnwrap()).toBe(100)
    })

    it('p=1e-17, N=100, m=0.5, c=0.9 は NonFiniteResult（calculateTrialCount 経由、救済対象外）', () => {
      const result = calculateTrialCountWithPity(1e-17, 100, 0.5, 0.9)
      expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('p=1e-17, N=100, m=0.05, c=0.9 では m≤1-c の救済路で N=100 を返す（数学的に k=N で P≥c）', () => {
      expect(calculateTrialCountWithPity(1e-17, 100, 0.05, 0.9)._unsafeUnwrap()).toBe(100)
    })

    it('p=1e-17, N=100, m=0.099 (<1-c=0.1), c=0.9 は m≤1-c 救済路で N=100 を返す（境界直下）', () => {
      expect(calculateTrialCountWithPity(1e-17, 100, 0.099, 0.9)._unsafeUnwrap()).toBe(100)
    })

    it('救済路は NonFiniteResult 限定（InvalidInput は救済されず err 透過）', () => {
      // safeParse をモックして InvalidInput を強制注入する。
      // 救済路の条件 m ≤ 1-c を満たしても、kind が NonFiniteResult でなければ救済しない。
      vi.mocked(v.safeParse).mockImplementationOnce(() => ({
        typed: false,
        success: false,
        output: undefined,
        issues: [{
          kind: 'validation',
          type: 'custom',
          input: 0.5,
          expected: null,
          received: '0.5',
          message: 'forced invalid input',
        } as v.BaseIssue<unknown>],
      }) as unknown as ReturnType<typeof v.safeParse>)
      const result = calculateTrialCountWithPity(0.5, 100, 0, 0.9)
      // 救済路に入らず、InvalidInput がそのまま透過する
      expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })
})

describe('tryCalculateTrialCountWithPity（Result 型ラッパ）', () => {
  it('成功時は ok を返す', () => {
    expect(tryCalculateTrialCountWithPity(0.5, 10, 0, 0.9)._unsafeUnwrap()).toBe(4)
  })

  it('p=0 は err、文言に「成功率」を含む', () => {
    const r = tryCalculateTrialCountWithPity(0, 10, 0.5, 0.9)
    expect(formatDomainError(r._unsafeUnwrapErr())).toMatch(/成功率/)
  })

  it('m=-1 は err、文言に「すり抜け率」を含む', () => {
    const r = tryCalculateTrialCountWithPity(0.5, 10, -1, 0.9)
    expect(formatDomainError(r._unsafeUnwrapErr())).toMatch(/すり抜け率/)
  })

  it('N=0 は err、文言に「試行回数」を含む', () => {
    const r = tryCalculateTrialCountWithPity(0.5, 0, 0.5, 0.9)
    expect(formatDomainError(r._unsafeUnwrapErr())).toMatch(/試行回数/)
  })

  it('浮動小数点境界 (p=1e-17, m=0.5) は err', () => {
    expect(tryCalculateTrialCountWithPity(1e-17, 100, 0.5, 0.9).isErr()).toBe(true)
  })

  it('浮動小数点境界 (p=1e-17, m=0) は ok で N を返す', () => {
    expect(tryCalculateTrialCountWithPity(1e-17, 100, 0, 0.9)._unsafeUnwrap()).toBe(100)
  })

  it('複数 issue を持つバリデーション失敗は全 issue.message を \\n 区切りで結合', () => {
    const issue1: v.BaseIssue<unknown> = {
      kind: 'validation',
      type: 'custom',
      input: 0.05,
      expected: null,
      received: '0.05',
      message: 'M1',
    }
    const issue2: v.BaseIssue<unknown> = {
      kind: 'validation',
      type: 'custom',
      input: 100,
      expected: null,
      received: '100',
      message: 'M2',
    }
    vi.mocked(v.safeParse).mockImplementationOnce(() => ({
      typed: false,
      success: false,
      output: undefined,
      issues: [issue1, issue2],
    }) as unknown as ReturnType<typeof v.safeParse>)
    const r = tryCalculateTrialCountWithPity(0.05, 100, 0.5)
    expect(r.isErr()).toBe(true)
    const message = formatDomainError(r._unsafeUnwrapErr())
    expect(message).toContain('M1')
    expect(message).toContain('M2')
    expect(message.split('\n').length).toBeGreaterThanOrEqual(2)
  })
})

describe('validSlipRateRatioSchema', () => {
  it('境界値 0 を渡すとそのまま 0 を返す', () => {
    expect(v.parse(validSlipRateRatioSchema, 0)).toBe(0)
  })

  it('境界値 1 を渡すとそのまま 1 を返す', () => {
    expect(v.parse(validSlipRateRatioSchema, 1)).toBe(1)
  })

  it('-0.01 で ValiError', () => {
    expect(() => v.parse(validSlipRateRatioSchema, -0.01)).toThrow(/すり抜け率/)
  })

  it('1.01 で ValiError', () => {
    expect(() => v.parse(validSlipRateRatioSchema, 1.01)).toThrow(/すり抜け率/)
  })
})

describe('slipRatePercentageSchema', () => {
  it('境界値 0 を渡すとそのまま 0 を返す', () => {
    expect(v.parse(slipRatePercentageSchema, 0)).toBe(0)
  })

  it('境界値 100 を渡すとそのまま 100 を返す', () => {
    expect(v.parse(slipRatePercentageSchema, 100)).toBe(100)
  })

  it('文字列 "50" を渡すと 50 に変換される', () => {
    expect(v.parse(slipRatePercentageSchema, '50')).toBe(50)
  })

  it('-1 で ValiError、メッセージに「0以上100以下」を含む', () => {
    expect(() => v.parse(slipRatePercentageSchema, -1)).toThrow(/0以上100以下/)
  })

  it('101 で ValiError', () => {
    expect(() => v.parse(slipRatePercentageSchema, 101)).toThrow(/0以上100以下/)
  })
})
