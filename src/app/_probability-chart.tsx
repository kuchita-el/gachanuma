'use client'

import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { calculateCumulativeSuccessProbability } from '@/probability/calculator'
import { computeXAxisUpperBound, sampleTrialCounts } from '@/probability/chart-range'
import { percentToRatio } from '@/probability/probability'

const CHART_WIDTH = 600
const CHART_HEIGHT = 320
const Y_TICKS = [0, 25, 50, 75, 100]
const DEFAULT_CONFIDENCE_PERCENT = 90

interface ProbabilityChartProps {
  successRatePercent: number
  confidencePercent: number
}

/**
 * 試行回数 N に対する累積成功確率 1-(1-p)^N の折れ線グラフ。
 * 信頼度 c の水平破線（右端ラベル）と、c≠90 の場合は 90% デフォルト線を併記。
 *
 * jsdom 互換のため `ResponsiveContainer` は使わず固定サイズで描画する（recharts issue #1423）。
 */
export function ProbabilityChart({
  successRatePercent,
  confidencePercent,
}: ProbabilityChartProps) {
  const rate = percentToRatio(successRatePercent)
  const upperBound = computeXAxisUpperBound(rate)
  const data = sampleTrialCounts(upperBound).map(n => ({
    trialCount: n,
    cumulativeProbabilityPercent: calculateCumulativeSuccessProbability(rate, n) * 100,
  }))

  // 信頼度=90 のときはデフォルト90破線と重複するので主補助線のみ描画
  const showDefaultGuide = confidencePercent !== DEFAULT_CONFIDENCE_PERCENT

  return (
    <div data-testid="probability-chart" className="mt-4">
      <LineChart
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        data={data}
        margin={{ top: 16, right: 48, bottom: 32, left: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="trialCount"
          type="number"
          domain={[1, upperBound]}
          stroke="var(--foreground)"
        >
          <Label value="試行回数" position="insideBottom" offset={-12} fill="var(--foreground)" />
        </XAxis>
        <YAxis
          type="number"
          domain={[0, 100]}
          ticks={Y_TICKS}
          stroke="var(--foreground)"
        >
          <Label
            value="累積成功確率 (%)"
            angle={-90}
            position="insideLeft"
            offset={16}
            fill="var(--foreground)"
            style={{ textAnchor: 'middle' }}
          />
        </YAxis>
        <Line
          type="monotone"
          dataKey="cumulativeProbabilityPercent"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <ReferenceLine
          y={confidencePercent}
          stroke="var(--chart-2)"
          strokeWidth={1}
          strokeDasharray="4 4"
          label={{
            value: `${confidencePercent}%`,
            position: 'right',
            fill: 'var(--chart-2)',
          }}
        />
        {showDefaultGuide && (
          <ReferenceLine
            y={DEFAULT_CONFIDENCE_PERCENT}
            stroke="var(--chart-1)"
            strokeWidth={1}
            strokeDasharray="4 4"
            label={{
              value: `${DEFAULT_CONFIDENCE_PERCENT}%`,
              position: 'right',
              fill: 'var(--chart-1)',
            }}
          />
        )}
      </LineChart>
    </div>
  )
}
