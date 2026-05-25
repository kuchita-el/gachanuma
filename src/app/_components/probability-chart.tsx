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
import { Result } from 'neverthrow'
import { calculateCumulativeSuccessProbability } from '@/probability/calculator'
import { computeXAxisUpperBound, sampleTrialCounts } from '@/probability/chart-range'
import { formatDomainError, parseInputOrErr } from '@/probability/domain-error'
import { validProbabilityRatioSchema } from '@/probability/probability'
import { DEFAULT_CONFIDENCE_PERCENT, percentToRatio } from './form-schemas'

const CHART_WIDTH = 600
const CHART_HEIGHT = 320
const Y_TICKS = [0, 25, 50, 75, 100]

interface ProbabilityChartProps {
  successRatePercent: number
  confidencePercent: number
}

/**
 * 試行回数 N に対する累積成功確率 1-(1-p)^N の折れ線グラフ。
 * 信頼度 c の水平破線（右端ラベル）と、c≠90 の場合は 90% デフォルト線を併記。
 *
 * jsdom 互換のため `ResponsiveContainer` は使わず固定サイズで描画する（recharts issue #1423）。
 * 計算層エラー（InvalidInput / NonFiniteResult）は Result チェーンで受け、err なら inline で
 * `formatDomainError` 経由のエラー文言を表示する（silent failure 回避）。
 */
export function ProbabilityChart({
  successRatePercent,
  confidencePercent,
}: ProbabilityChartProps) {
  // rate のブランド化 → upperBound → サンプル点列 → 各点の累積確率を Result チェーンで連結し、
  // どこかで err が出れば全体を err として match の err 分岐でインラインエラー表示にフォールバックする。
  // ブランド化境界の parse も safeParse ベース（parseInputOrErr）で受け、計算層と同じ throw なし契約に揃える。
  const chartResult = parseInputOrErr(
    validProbabilityRatioSchema,
    percentToRatio(successRatePercent),
  ).andThen(rate =>
    computeXAxisUpperBound(rate).andThen(upperBound =>
      sampleTrialCounts(upperBound).andThen(samples =>
        Result.combine(
          samples.map(n =>
            calculateCumulativeSuccessProbability(rate, n).map(value => ({
              trialCount: n,
              cumulativeProbabilityPercent: value * 100,
            })),
          ),
        ).map(data => ({ upperBound, data })),
      ),
    ),
  )

  // 信頼度=90 のときはデフォルト90破線と重複するので主補助線のみ描画
  const showDefaultGuide = confidencePercent !== DEFAULT_CONFIDENCE_PERCENT

  return chartResult.match(
    ({ upperBound, data }) => (
      <div
        data-testid="probability-chart"
        role="img"
        aria-label="試行回数に対する累積成功確率の折れ線グラフ"
        className="mt-4"
      >
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
    ),
    error => (
      <div
        role="img"
        aria-label="グラフエラー"
        className="text-muted-foreground mt-4 text-sm"
      >
        グラフを描画できません:
        {' '}
        {formatDomainError(error)}
      </div>
    ),
  )
}
