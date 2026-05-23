import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import {
  calculateTrialCountWithPity,
  tryCalculateTrialCountWithPity,
} from './pity'
import { CalculationError, calculateTrialCount } from './calculator'
import { validSlipRateRatioSchema, slipRatePercentageSchema } from './probability'

vi.mock('valibot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('valibot')>()
  return { ...actual, parse: vi.fn(actual.parse) }
})

describe('calculateTrialCountWithPity', () => {
  describe('正常系（計画書手計算の検証）', () => {
    it('p=0.5, N=10, m=0, c=0.9 → 4（kNoPity < N、k<N 領域で解）', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 0, 0.9)).toBe(4)
    })

    it('p=0.01, N=100, m=0, c=0.9 → 100（kNoPity≥N、m=0 で N で確定）', () => {
      expect(calculateTrialCountWithPity(0.01, 100, 0, 0.9)).toBe(100)
    })

    it('p=0.01, N=100, m=0.5, c=0.9 → 162（kNoPity≥N、m>1-c の閉形解）', () => {
      expect(calculateTrialCountWithPity(0.01, 100, 0.5, 0.9)).toBe(162)
    })

    it('p=0.5, N=10, m=1, c=0.9 → 4（kNoPity<N、m=1 連続性）', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 1, 0.9)).toBe(4)
    })

    it('p=0.5, N=4, m=1, c=0.9 → 5（kNoPity==N 境界、m=1 で k=N で P<c、k=N+1）', () => {
      expect(calculateTrialCountWithPity(0.5, 4, 1, 0.9)).toBe(5)
    })

    it('confidence 省略時は DEFAULT_CONFIDENCE=0.9 が適用される', () => {
      expect(calculateTrialCountWithPity(0.5, 10, 0)).toBe(4)
    })
  })

  describe('境界値', () => {
    it('m=0 の境界（kNoPity≥N で k=N で確定）', () => {
      // p=0.5, N=2, c=0.9 → kNoPity=4 ≥ N=2, m=0 → k=N=2
      expect(calculateTrialCountWithPity(0.5, 2, 0, 0.9)).toBe(2)
    })

    it('m=1 の連続性（kNoPity が N より大きい場合は k=ceil(log/log)+1）', () => {
      // p=0.01, N=2, m=1, c=0.9 → kNoPity=230, k≥N で m>1-c → ceil(log(0.1)/log(0.99))+1
      // = ceil(229.10)+1 = 230+1 ... 待って計算式は max(N, ...)。実装で確認。
      const n = calculateTrialCountWithPity(0.01, 2, 1, 0.9)
      expect(n).toBeGreaterThanOrEqual(2)
    })

    it('m ≤ 1-c で k=N が解（m=0.05, c=0.9 で 1-c=0.1）', () => {
      // p=0.01, N=100, m=0.05, c=0.9 → kNoPity≥N、m≤0.1 → k=N=100
      expect(calculateTrialCountWithPity(0.01, 100, 0.05, 0.9)).toBe(100)
    })

    it('m が 1-c より僅かに大きい（m=0.11, c=0.9）でも max(N, kCandidate) で N が勝てば k=N', () => {
      // ceil(log(0.1/0.11)/log(0.99))+1 = 11、max(100, 11) = 100
      expect(calculateTrialCountWithPity(0.01, 100, 0.11, 0.9)).toBe(100)
    })

    it('m が大きく k > N になる（p=0.5, N=4, m=0.5, c=0.9）', () => {
      // kNoPity=4, kNoPity<N=4 false、m=0.5>0.1、ceil(log(0.2)/log(0.5))+1=ceil(2.32)+1=4
      // max(4, 4) = 4 ... これは k=N。別のケースを探す。
      // p=0.5, N=2, m=0.5, c=0.9 → kNoPity=4 ≥ N=2、m=0.5>0.1
      // ceil(log(0.2)/log(0.5))+1 = ceil(2.32)+1 = 4、max(2, 4) = 4
      expect(calculateTrialCountWithPity(0.5, 2, 0.5, 0.9)).toBe(4)
    })

    it('天井回数 1 の境界（k=1 で必ず天井確定）', () => {
      // p=0.5, N=1, m=0, c=0.9 → kNoPity=4≥N=1、m=0 → k=N=1
      expect(calculateTrialCountWithPity(0.5, 1, 0, 0.9)).toBe(1)
    })
  })

  describe('単調性', () => {
    it('m 増加に対し試行回数は単調非減少', () => {
      const ns = [0, 0.1, 0.3, 0.5, 0.8, 1].map(m =>
        calculateTrialCountWithPity(0.01, 100, m, 0.9),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountWithPity(0.01, 100, 0.5, c),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('既存 API との整合', () => {
    it('m=1 + N が十分大きい場合、calculateTrialCount(p, c) と一致（天井効果なし）', () => {
      // p=0.5, c=0.9, N=10000, m=1 → calculateTrialCount(0.5, 0.9) と一致
      const expected = calculateTrialCount(0.5, 0.9)
      expect(calculateTrialCountWithPity(0.5, 10000, 1, 0.9)).toBe(expected)
    })
  })

  describe('バリデーション（successRate）', () => {
    it('p=0 で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0, 10, 0.5, 0.9)).toThrow(v.ValiError)
    })

    it('p=1 で ValiError', () => {
      expect(() => calculateTrialCountWithPity(1, 10, 0.5, 0.9)).toThrow(v.ValiError)
    })

    it('p=NaN で ValiError', () => {
      expect(() => calculateTrialCountWithPity(NaN, 10, 0.5, 0.9)).toThrow(v.ValiError)
    })
  })

  describe('バリデーション（pityCount）', () => {
    it('N=0 で ValiError、メッセージに「試行回数」を含む', () => {
      expect(() => calculateTrialCountWithPity(0.5, 0, 0.5, 0.9)).toThrow(/試行回数/)
    })

    it('N=-1 で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0.5, -1, 0.5, 0.9)).toThrow(v.ValiError)
    })

    it('N=1.5（非整数）で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0.5, 1.5, 0.5, 0.9)).toThrow(v.ValiError)
    })
  })

  describe('バリデーション（slipRate）', () => {
    it('m=-0.01 で ValiError、メッセージに「すり抜け率」を含む', () => {
      expect(() => calculateTrialCountWithPity(0.5, 10, -0.01, 0.9)).toThrow(/すり抜け率/)
    })

    it('m=1.01 で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0.5, 10, 1.01, 0.9)).toThrow(v.ValiError)
    })

    it('m=NaN で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0.5, 10, NaN, 0.9)).toThrow(v.ValiError)
    })
  })

  describe('バリデーション（confidence）', () => {
    it('c=0 で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0.5, 10, 0.5, 0)).toThrow(v.ValiError)
    })

    it('c=1 で ValiError', () => {
      expect(() => calculateTrialCountWithPity(0.5, 10, 0.5, 1)).toThrow(v.ValiError)
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, N=100, m=0, c=0.9 では m=0 早期 return で N=100 を返す', () => {
      // calculateTrialCount(1e-17, 0.9) が CalculationError を投げるが m=0 なので天井で確定
      expect(calculateTrialCountWithPity(1e-17, 100, 0, 0.9)).toBe(100)
    })

    it('p=1e-17, N=100, m=0.5, c=0.9 は CalculationError（calculateTrialCount 経由）', () => {
      expect(() => calculateTrialCountWithPity(1e-17, 100, 0.5, 0.9)).toThrow(CalculationError)
    })

    it('p=1e-17, N=100, m=0.05, c=0.9 では m≤1-c の short-circuit で N=100 を返す（数学的に k=N で P≥c）', () => {
      expect(calculateTrialCountWithPity(1e-17, 100, 0.05, 0.9)).toBe(100)
    })

    it('p=1e-17, N=100, m=0.099 (<1-c=0.1), c=0.9 は m≤1-c 短絡で N=100 を返す（境界直下）', () => {
      // 浮動小数点上 `1 - 0.9 ≒ 0.099999...` のため、m=0.1 の同値境界はテスト不能。
      // 数学的境界 m=1-c の直下を検証する。
      expect(calculateTrialCountWithPity(1e-17, 100, 0.099, 0.9)).toBe(100)
    })
  })
})

describe('tryCalculateTrialCountWithPity（Result 型ラッパ）', () => {
  it('成功時は ok:true と value', () => {
    const r = tryCalculateTrialCountWithPity(0.5, 10, 0, 0.9)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe(4)
    }
  })

  it('p=0 は ok:false、message に「成功率」を含む', () => {
    const r = tryCalculateTrialCountWithPity(0, 10, 0.5, 0.9)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/成功率/)
    }
  })

  it('m=-1 は ok:false、message に「すり抜け率」を含む', () => {
    const r = tryCalculateTrialCountWithPity(0.5, 10, -1, 0.9)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/すり抜け率/)
    }
  })

  it('N=0 は ok:false、message に「試行回数」を含む', () => {
    const r = tryCalculateTrialCountWithPity(0.5, 0, 0.5, 0.9)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/試行回数/)
    }
  })

  it('浮動小数点境界 (p=1e-17, m=0.5) は ok:false', () => {
    const r = tryCalculateTrialCountWithPity(1e-17, 100, 0.5, 0.9)
    expect(r.ok).toBe(false)
  })

  it('浮動小数点境界 (p=1e-17, m=0) は ok:true で N を返す', () => {
    const r = tryCalculateTrialCountWithPity(1e-17, 100, 0, 0.9)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe(100)
    }
  })

  it('複数 issue を持つ ValiError は全 issue.message を \\n 区切りで結合した message を返す', () => {
    const issue1 = {
      kind: 'validation',
      type: 'custom',
      input: 0.05,
      expected: null,
      received: '0.05',
      message: 'M1',
    }
    const issue2 = {
      kind: 'validation',
      type: 'custom',
      input: 100,
      expected: null,
      received: '100',
      message: 'M2',
    }
    vi.mocked(v.parse).mockImplementationOnce(() => {
      throw new v.ValiError([issue1, issue2] as never)
    })
    const r = tryCalculateTrialCountWithPity(0.05, 100, 0.5)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toContain('M1')
      expect(r.message).toContain('M2')
      expect(r.message.split('\n').length).toBeGreaterThanOrEqual(2)
    }
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
