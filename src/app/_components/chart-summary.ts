/** 累積成功確率グラフの代替テキスト（要約文）（Issue #25） */
import * as v from 'valibot'
import { formatCount, formatInputPercent, formatProbabilityPercent } from '@/lib/format-number'
import {
  calculateTrialCountOnCurve,
  evaluateSuccessCurve,
  type SuccessCurve,
} from '@/probability/success-curve'
import { type TrialCount, validConfidenceSchema } from '@/probability/value-types'

/** 要約に載せる到達点（信頼度） */
const MILESTONE_PERCENTS = [50, 90, 99] as const

/** グラフ上の注目点（マーカー） */
export type ChartMarker = {
  trialCount: TrialCount
  /** 要約での注目点の呼び名（例: 「計算結果」「入力した試行回数」） */
  caption: string
}

function describeCurve(curve: SuccessCurve): string {
  const rate = `成功率${formatInputPercent(curve.successRate)}`
  switch (curve.kind) {
    case 'single':
      return `${rate}で少なくとも1回成功する確率`
    case 'multiple':
      return curve.targetCount === 1
        ? `${rate}で少なくとも1回成功する確率`
        : `${rate}で${formatCount(curve.targetCount)}回以上成功する確率`
    case 'pity':
      return `${rate}、天井${formatCount(curve.pityCount)}回・すり抜け率${formatInputPercent(curve.slipRate)}で少なくとも1回成功する確率`
    default: {
      const unreachable: never = curve
      return unreachable
    }
  }
}

/**
 * グラフが伝える情報（50%・90%・99% に到達する試行回数と、マーカー位置の確率）を文章にする。
 * 視覚的に隠した表で全点を読ませる案は、200 点では冗長なため採らない。
 * 計算できない到達点は省く（例: 反復上限を超える場合）。
 *
 * 例: 「成功率1%で少なくとも1回成功する確率のグラフ。50%到達は69回、90%到達は230回、99%到達は459回。計算結果の230回で90.09%。」
 */
export function describeChart(curve: SuccessCurve, marker: ChartMarker): string {
  const milestones = MILESTONE_PERCENTS.flatMap(percent =>
    calculateTrialCountOnCurve(curve, v.parse(validConfidenceSchema, percent / 100)).match(
      n => [`${percent}%到達は${formatCount(n)}回`],
      () => [],
    ),
  )
  const markerText = evaluateSuccessCurve(curve, marker.trialCount).match(
    ratio => `${marker.caption}の${formatCount(marker.trialCount)}回で${formatProbabilityPercent(ratio)}。`,
    () => '',
  )
  const milestoneText = milestones.length > 0 ? `${milestones.join('、')}。` : ''
  return `${describeCurve(curve)}のグラフ。${milestoneText}${markerText}`
}
