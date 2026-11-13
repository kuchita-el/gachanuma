import { describe, expect, it } from 'vitest'
import { formatCount, formatProbabilityPercent } from './format-number'

describe('formatCount', () => {
  it('999 は桁区切りなし', () => {
    expect(formatCount(999)).toBe('999')
  })

  it('1000 は「1,000」', () => {
    expect(formatCount(1000)).toBe('1,000')
  })

  it('46050 は「46,050」', () => {
    expect(formatCount(46050)).toBe('46,050')
  })

  it('123456789 は「123,456,789」', () => {
    expect(formatCount(123456789)).toBe('123,456,789')
  })
})

describe('formatProbabilityPercent', () => {
  it('99.994% は小数2桁で「99.99%」', () => {
    expect(formatProbabilityPercent(0.99994)).toBe('99.99%')
  })

  it('99.995% は「99.99%超」（toFixed(2) で 100.00 になる境界）', () => {
    expect(formatProbabilityPercent(0.99995)).toBe('99.99%超')
  })

  it('ratio が 1 に丸まったケースも「99.99%超」（100% と表示しない）', () => {
    expect(formatProbabilityPercent(1)).toBe('99.99%超')
  })

  it('99.99% ちょうどは小数2桁で「99.99%」', () => {
    expect(formatProbabilityPercent(0.9999)).toBe('99.99%')
  })

  it('中間値は小数2桁（現行どおり）', () => {
    expect(formatProbabilityPercent(0.634)).toBe('63.40%')
    expect(formatProbabilityPercent(0.5)).toBe('50.00%')
  })

  it('0.005% は小数2桁の範囲', () => {
    expect(formatProbabilityPercent(0.00005)).toBe('0.01%')
  })

  it('0.0049% は有効数字2桁で「0.0049%」', () => {
    expect(formatProbabilityPercent(0.000049)).toBe('0.0049%')
  })

  it('1e-6（0.0001%）は有効数字表示で末尾の 0 を出さない', () => {
    expect(formatProbabilityPercent(1e-6)).toBe('0.0001%')
  })

  it('0（アンダーフロー）は「0.01%未満」（0% と表示しない）', () => {
    expect(formatProbabilityPercent(0)).toBe('0.01%未満')
  })
})
