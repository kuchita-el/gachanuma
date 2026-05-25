import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { err } from 'neverthrow'
import { calculateTrialCountWithPity } from './pity'
import * as calculator from './calculator'
import { calculateTrialCount } from './calculator'
import {
  validConfidenceSchema,
  validPityCountSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
} from './probability'

// 救済路の kind 判別を直接検証するため、`calculateTrialCount` 自体を spy 化して
// 任意の DomainError を注入できるようにする。
vi.mock('./calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./calculator')>()
  return { ...actual, calculateTrialCount: vi.fn(actual.calculateTrialCount) }
})

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const conf = (r: number) => v.parse(validConfidenceSchema, r)
const slip = (r: number) => v.parse(validSlipRateRatioSchema, r)
const pity = (n: number) => v.parse(validPityCountSchema, n)

describe('calculateTrialCountWithPity', () => {
  describe('正常系（計画書手計算の検証）', () => {
    it('p=0.5, N=10, m=0, c=0.9 → 4（kNoPity < N、k<N 領域で解）', () => {
      expect(calculateTrialCountWithPity(prob(0.5), pity(10), slip(0), conf(0.9))._unsafeUnwrap()).toBe(4)
    })

    it('p=0.01, N=100, m=0, c=0.9 → 100（kNoPity≥N、m=0 で N で確定）', () => {
      expect(calculateTrialCountWithPity(prob(0.01), pity(100), slip(0), conf(0.9))._unsafeUnwrap()).toBe(100)
    })

    it('p=0.01, N=100, m=0.5, c=0.9 → 162（kNoPity≥N、m>1-c の閉形解）', () => {
      expect(calculateTrialCountWithPity(prob(0.01), pity(100), slip(0.5), conf(0.9))._unsafeUnwrap()).toBe(162)
    })

    it('p=0.5, N=10, m=1, c=0.9 → 4（kNoPity<N、m=1 連続性）', () => {
      expect(calculateTrialCountWithPity(prob(0.5), pity(10), slip(1), conf(0.9))._unsafeUnwrap()).toBe(4)
    })

    it('p=0.5, N=4, m=1, c=0.9 → 5（kNoPity==N 境界、m=1 で k=N で P<c、k=N+1）', () => {
      expect(calculateTrialCountWithPity(prob(0.5), pity(4), slip(1), conf(0.9))._unsafeUnwrap()).toBe(5)
    })
  })

  describe('境界値', () => {
    it('m=0 の境界（kNoPity≥N で k=N で確定）', () => {
      expect(calculateTrialCountWithPity(prob(0.5), pity(2), slip(0), conf(0.9))._unsafeUnwrap()).toBe(2)
    })

    it('m=1 の連続性（kNoPity が N より大きい場合は k=ceil(log/log)+1）', () => {
      const n = calculateTrialCountWithPity(prob(0.01), pity(2), slip(1), conf(0.9))._unsafeUnwrap()
      expect(n).toBeGreaterThanOrEqual(2)
    })

    it('m ≤ 1-c で k=N が解（m=0.05, c=0.9 で 1-c=0.1）', () => {
      expect(calculateTrialCountWithPity(prob(0.01), pity(100), slip(0.05), conf(0.9))._unsafeUnwrap()).toBe(100)
    })

    it('m が 1-c より僅かに大きい（m=0.11, c=0.9）でも max(N, kCandidate) で N が勝てば k=N', () => {
      expect(calculateTrialCountWithPity(prob(0.01), pity(100), slip(0.11), conf(0.9))._unsafeUnwrap()).toBe(100)
    })

    it('m が大きく k > N になる（p=0.5, N=2, m=0.5, c=0.9）', () => {
      expect(calculateTrialCountWithPity(prob(0.5), pity(2), slip(0.5), conf(0.9))._unsafeUnwrap()).toBe(4)
    })

    it('天井回数 1 の境界（k=1 で必ず天井確定）', () => {
      expect(calculateTrialCountWithPity(prob(0.5), pity(1), slip(0), conf(0.9))._unsafeUnwrap()).toBe(1)
    })
  })

  describe('単調性', () => {
    it('m 増加に対し試行回数は単調非減少', () => {
      const ns = [0, 0.1, 0.3, 0.5, 0.8, 1].map(m =>
        calculateTrialCountWithPity(prob(0.01), pity(100), slip(m), conf(0.9))._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountWithPity(prob(0.01), pity(100), slip(0.5), conf(c))._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('既存 API との整合', () => {
    it('m=1 + N が十分大きい場合、calculateTrialCount(p, c) と一致（天井効果なし）', () => {
      const expected = calculateTrialCount(prob(0.5), conf(0.9))._unsafeUnwrap()
      expect(calculateTrialCountWithPity(prob(0.5), pity(10000), slip(1), conf(0.9))._unsafeUnwrap()).toBe(expected)
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, N=100, m=0, c=0.9 では m=0 救済路で N=100 を返す', () => {
      expect(calculateTrialCountWithPity(prob(1e-17), pity(100), slip(0), conf(0.9))._unsafeUnwrap()).toBe(100)
    })

    it('p=1e-17, N=100, m=0.5, c=0.9 は NonFiniteResult（calculateTrialCount 経由、救済対象外）', () => {
      const result = calculateTrialCountWithPity(prob(1e-17), pity(100), slip(0.5), conf(0.9))
      expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('p=1e-17, N=100, m=0.05, c=0.9 では m≤1-c の救済路で N=100 を返す（数学的に k=N で P≥c）', () => {
      expect(calculateTrialCountWithPity(prob(1e-17), pity(100), slip(0.05), conf(0.9))._unsafeUnwrap()).toBe(100)
    })

    it('p=1e-17, N=100, m=0.099 (<1-c=0.1), c=0.9 は m≤1-c 救済路で N=100 を返す（境界直下）', () => {
      expect(calculateTrialCountWithPity(prob(1e-17), pity(100), slip(0.099), conf(0.9))._unsafeUnwrap()).toBe(100)
    })

    it('救済路は NonFiniteResult 限定（InvalidInput は救済されず err 透過）', () => {
      // `calculateTrialCount` 自体を mock して InvalidInput を返させる。
      // 救済路の条件 m=0 ≤ 1-c を満たしても、kind が NonFiniteResult でなければ救済しない。
      vi.mocked(calculator.calculateTrialCount).mockReturnValueOnce(
        err({ kind: 'InvalidInput', issues: [{ message: 'forced invalid input' }] }),
      )
      const result = calculateTrialCountWithPity(prob(0.5), pity(100), slip(0), conf(0.9))
      // 救済路に入らず、InvalidInput がそのまま透過する
      expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
    })
  })
})

describe('validPityCountSchema', () => {
  it('典型値 1 を渡すとそのまま 1 を返す', () => {
    expect(v.parse(validPityCountSchema, 1)).toBe(1)
  })

  it('正の整数（100）を渡すとそのまま返す', () => {
    expect(v.parse(validPityCountSchema, 100)).toBe(100)
  })

  it('0 を渡すと ValiError、メッセージに「天井回数」を含む（TrialCount 流用解消）', () => {
    expect(() => v.parse(validPityCountSchema, 0)).toThrow(/天井回数/)
  })

  it('-1 を渡すと ValiError', () => {
    expect(() => v.parse(validPityCountSchema, -1)).toThrow()
  })

  it('小数 1.5 を渡すと ValiError、メッセージに「天井回数」を含む', () => {
    expect(() => v.parse(validPityCountSchema, 1.5)).toThrow(/天井回数/)
  })

  it('NaN を渡すと ValiError', () => {
    expect(() => v.parse(validPityCountSchema, NaN)).toThrow()
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
