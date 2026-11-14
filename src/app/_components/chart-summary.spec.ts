import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { describeChart } from './chart-summary'
import type { SuccessCurve } from '@/probability/success-curve'
import {
  validPityCountSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTargetCountSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const trial = (n: number) => v.parse(validTrialCountSchema, n)

describe('describeChart', () => {
  it('順算（単発）: 50%・90%・99% の到達回数と、計算結果の確率', () => {
    expect(describeChart({ kind: 'single', successRate: prob(0.01) }, { trialCount: trial(230), caption: '計算結果' }))
      .toBe('成功率1%で少なくとも1回成功する確率のグラフ。50%到達は69回、90%到達は230回、99%到達は459回。計算結果の230回で90.09%。')
  })

  it('逆算: 入力した試行回数の確率', () => {
    expect(describeChart({ kind: 'single', successRate: prob(0.01) }, { trialCount: trial(100), caption: '入力した試行回数' }))
      .toBe('成功率1%で少なくとも1回成功する確率のグラフ。50%到達は69回、90%到達は230回、99%到達は459回。入力した試行回数の100回で63.40%。')
  })

  it('複数回成功: 目標成功回数を含める', () => {
    const curve: SuccessCurve = {
      kind: 'multiple',
      successRate: prob(0.5),
      targetCount: v.parse(validTargetCountSchema, 2),
    }
    expect(describeChart(curve, { trialCount: trial(7), caption: '計算結果' }))
      .toMatch(/^成功率50%で2回以上成功する確率のグラフ。50%到達は3回、90%到達は7回、99%到達は\d+回。計算結果の7回で93\.75%。$/)
  })

  it('目標成功回数 1 は「少なくとも1回」と書く', () => {
    const curve: SuccessCurve = {
      kind: 'multiple',
      successRate: prob(0.5),
      targetCount: v.parse(validTargetCountSchema, 1),
    }
    expect(describeChart(curve, { trialCount: trial(4), caption: '計算結果' }))
      .toMatch(/^成功率50%で少なくとも1回成功する確率のグラフ。/)
  })

  it('天井あり: 天井回数とすり抜け率を含める（成功率の比率 ×100 の誤差を出さない）', () => {
    const curve: SuccessCurve = {
      kind: 'pity',
      successRate: prob(0.007),
      pityCount: v.parse(validPityCountSchema, 100),
      slipRate: v.parse(validSlipRateRatioSchema, 0.5),
    }
    expect(describeChart(curve, { trialCount: trial(150), caption: '計算結果' }))
      .toMatch(/^成功率0\.7%、天井100回・すり抜け率50%で少なくとも1回成功する確率のグラフ。/)
  })

  it('計算できない到達点・確率は省く（成功率が極小）', () => {
    expect(describeChart({ kind: 'single', successRate: prob(1e-17) }, { trialCount: trial(1), caption: '計算結果' }))
      .toBe('成功率0.000000000000001%で少なくとも1回成功する確率のグラフ。')
  })
})
