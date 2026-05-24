import { describe, expect, it } from 'vitest'
import {
  type DomainError,
  formatDomainError,
  parseInputOrErr,
} from './domain-error'
import { validProbabilityRatioSchema } from './probability'

describe('formatDomainError', () => {
  it('InvalidInput は issues.message を改行結合', () => {
    const error: DomainError = {
      kind: 'InvalidInput',
      issues: [
        { message: '成功率は0より大きい値を指定してください。' },
        { message: '成功率は1未満の値を指定してください。' },
      ],
    }
    expect(formatDomainError(error)).toBe(
      '成功率は0より大きい値を指定してください。\n成功率は1未満の値を指定してください。',
    )
  })

  it('NonFiniteResult / calculateTrialCount は試行回数文言', () => {
    expect(
      formatDomainError({ kind: 'NonFiniteResult', source: 'calculateTrialCount' }),
    ).toBe('成功率が極端に小さいため試行回数を計算できません。値を見直してください。')
  })

  it('NonFiniteResult / calculateTrialCountWithPity も試行回数文言', () => {
    expect(
      formatDomainError({ kind: 'NonFiniteResult', source: 'calculateTrialCountWithPity' }),
    ).toBe('成功率が極端に小さいため試行回数を計算できません。値を見直してください。')
  })

  it('NonFiniteResult / calculateCumulativeSuccessProbability は累積成功確率文言', () => {
    expect(
      formatDomainError({ kind: 'NonFiniteResult', source: 'calculateCumulativeSuccessProbability' }),
    ).toBe('成功率が極端に小さいため累積成功確率を計算できません。値を見直してください。')
  })

  it('NonFiniteResult / calculateTrialCountForMultipleSuccess は数値表現不可文言', () => {
    expect(
      formatDomainError({ kind: 'NonFiniteResult', source: 'calculateTrialCountForMultipleSuccess' }),
    ).toBe('計算結果が数値として表現できません。値を見直してください。')
  })

  it('IterationLimitExceeded は反復上限文言', () => {
    expect(
      formatDomainError({
        kind: 'IterationLimitExceeded',
        source: 'calculateTrialCountForMultipleSuccess',
      }),
    ).toBe('反復上限を超えても累積確率が信頼度に達しませんでした。値を見直してください。')
  })
})

describe('parseInputOrErr', () => {
  it('スキーマ適合時は ok(output)', () => {
    const result = parseInputOrErr(validProbabilityRatioSchema, 0.5)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(0.5)
  })

  it('スキーマ不適合時は err({ kind: InvalidInput, issues })', () => {
    const result = parseInputOrErr(validProbabilityRatioSchema, 0)
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.kind).toBe('InvalidInput')
    if (error.kind === 'InvalidInput') {
      expect(error.issues.length).toBeGreaterThan(0)
      expect(error.issues[0]?.message).toContain('成功率は0より大きい')
    }
  })

  it('issues は formatDomainError に渡せる形式', () => {
    const result = parseInputOrErr(validProbabilityRatioSchema, 1)
    expect(result.isErr()).toBe(true)
    const message = formatDomainError(result._unsafeUnwrapErr())
    expect(message).toContain('成功率は1未満')
  })
})
