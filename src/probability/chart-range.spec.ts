import { describe, it, expect, vi } from 'vitest'
import { err } from 'neverthrow'
import {
  computeXAxisUpperBound,
  sampleTrialCounts,
} from './chart-range'
import { formatDomainError, parseInputOrErr } from './domain-error'

vi.mock('./domain-error', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./domain-error')>()
  return { ...actual, parseInputOrErr: vi.fn(actual.parseInputOrErr) }
})

describe('computeXAxisUpperBound', () => {
  it('p=0.5 → 11（N99=7, ceil(10.5)=11、AC2 検証）', () => {
    expect(computeXAxisUpperBound(0.5)._unsafeUnwrap()).toBe(11)
  })

  it('p=0.1 → 66（N99=44, ceil(66)=66）', () => {
    expect(computeXAxisUpperBound(0.1)._unsafeUnwrap()).toBe(66)
  })

  it('p=0.9 → 3（N99=2, ceil(3)=3、高成功率境界）', () => {
    expect(computeXAxisUpperBound(0.9)._unsafeUnwrap()).toBe(3)
  })

  it('p=0.01 → 689（N99=459, ceil(688.5)=689）', () => {
    expect(computeXAxisUpperBound(0.01)._unsafeUnwrap()).toBe(689)
  })

  it('p=0 は InvalidInput を err 返却', () => {
    expect(computeXAxisUpperBound(0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('p=1 は InvalidInput を err 返却', () => {
    expect(computeXAxisUpperBound(1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('p=NaN は InvalidInput を err 返却', () => {
    expect(computeXAxisUpperBound(NaN)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('p 極小（1e-17）は NonFiniteResult を err 返却（calculator 経由）', () => {
    expect(computeXAxisUpperBound(1e-17)._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
  })
})

describe('sampleTrialCounts', () => {
  it('upperBound <= maxPoints では全整数を返す（upperBound=11 → [1..11]）', () => {
    expect(sampleTrialCounts(11)._unsafeUnwrap()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('upperBound=1 では [1]', () => {
    expect(sampleTrialCounts(1)._unsafeUnwrap()).toEqual([1])
  })

  it('upperBound=200, maxPoints=200 では全整数 [1..200]', () => {
    const arr = sampleTrialCounts(200)._unsafeUnwrap()
    expect(arr).toHaveLength(200)
    expect(arr[0]).toBe(1)
    expect(arr[199]).toBe(200)
  })

  it('upperBound=689, maxPoints=200 では 200 点以下に圧縮、先頭1・末尾689', () => {
    const arr = sampleTrialCounts(689)._unsafeUnwrap()
    expect(arr.length).toBeLessThanOrEqual(200)
    expect(arr[0]).toBe(1)
    expect(arr[arr.length - 1]).toBe(689)
  })

  it('単調増加であること', () => {
    const arr = sampleTrialCounts(689)._unsafeUnwrap()
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]!).toBeGreaterThan(arr[i - 1]!)
    }
  })

  it('全要素が整数', () => {
    const arr = sampleTrialCounts(689)._unsafeUnwrap()
    for (const n of arr) {
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('全要素が 1 以上 upperBound 以下', () => {
    const arr = sampleTrialCounts(689)._unsafeUnwrap()
    for (const n of arr) {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(689)
    }
  })

  it('maxPoints をカスタムに指定できる', () => {
    const arr = sampleTrialCounts(1000, 10)._unsafeUnwrap()
    expect(arr.length).toBeLessThanOrEqual(10)
    expect(arr[0]).toBe(1)
    expect(arr[arr.length - 1]).toBe(1000)
  })

  it('upperBound=0 は InvalidInput を err 返却（1以上の整数前提）', () => {
    const result = sampleTrialCounts(0)
    expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/upperBound/)
  })

  it('upperBound=-1 は InvalidInput を err 返却', () => {
    expect(sampleTrialCounts(-1)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('upperBound=1.5（非整数）は InvalidInput を err 返却', () => {
    expect(sampleTrialCounts(1.5)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })

  it('maxPoints=1 は InvalidInput を err 返却（2以上必須、0除算を防ぐ）', () => {
    const result = sampleTrialCounts(100, 1)
    expect(result._unsafeUnwrapErr().kind).toBe('InvalidInput')
    expect(formatDomainError(result._unsafeUnwrapErr())).toMatch(/maxPoints/)
  })

  it('maxPoints=0 は InvalidInput を err 返却', () => {
    expect(sampleTrialCounts(100, 0)._unsafeUnwrapErr().kind).toBe('InvalidInput')
  })
})

describe('computeXAxisUpperBound (mock 経路)', () => {
  it('成功時は ok の Result を返す', () => {
    expect(computeXAxisUpperBound(0.5)._unsafeUnwrap()).toBe(11)
  })

  it('p=0 は err、文言に「成功率」を含む', () => {
    const r = computeXAxisUpperBound(0)
    expect(formatDomainError(r._unsafeUnwrapErr())).toMatch(/成功率/)
  })

  it('p=NaN は err 返却', () => {
    expect(computeXAxisUpperBound(NaN).isErr()).toBe(true)
  })

  it('p 極小（1e-17）は err 返却（NonFiniteResult 経由）', () => {
    expect(computeXAxisUpperBound(1e-17).isErr()).toBe(true)
  })

  it('複数 issue を持つバリデーション失敗は全 issue.message を \\n 区切りで結合', () => {
    vi.mocked(parseInputOrErr).mockReturnValueOnce(
      err({ kind: 'InvalidInput', issues: [{ message: 'M1' }, { message: 'M2' }] }),
    )
    const r = computeXAxisUpperBound(0.5)
    expect(r.isErr()).toBe(true)
    const message = formatDomainError(r._unsafeUnwrapErr())
    expect(message).toContain('M1')
    expect(message).toContain('M2')
    expect(message.split('\n').length).toBeGreaterThanOrEqual(2)
  })
})
