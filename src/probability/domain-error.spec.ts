import { describe, expect, it } from 'vitest'
import { parseInputOrErr } from './domain-error'
import { validProbabilityRatioSchema } from './value-types'

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
})
