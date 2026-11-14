'use client'

import { useSyncExternalStore } from 'react'
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
import { calculateCumulativeSuccessProbability } from '@/probability/cumulative-probability'
import { computeXAxisUpperBound, sampleTrialCounts } from './chart-range'
import { parseInputOrErr } from '@/probability/domain-error'
import { formatDomainError } from '@/lib/format-domain-error'
import { formatCount } from '@/lib/format-number'
import { validProbabilityRatioSchema } from '@/probability/value-types'
import { DEFAULT_CONFIDENCE_PERCENT, percentToRatio } from './form-schemas'

const Y_TICKS = [0, 25, 50, 75, 100]

/** 通常幅でのグラフ高さ（px） */
const CHART_HEIGHT = 320
/** 狭い幅（ビューポート 400px 未満）でのグラフ高さ（px） */
const NARROW_CHART_HEIGHT = 260
/** 通常幅での右マージン。参照線の右端ラベル（例: `90%`）の描画領域を確保する */
const CHART_MARGIN_RIGHT = 48
/** 狭い幅での右マージン。参照線ラベル（最大 `100%` 相当）が切れない最小値まで詰める */
const NARROW_CHART_MARGIN_RIGHT = 40
/** 狭い幅と判定するメディアクエリ */
const NARROW_MEDIA_QUERY = '(max-width: 399.98px)'

/**
 * ビューポートが狭い幅（< 400px）かを購読する。
 * SSR / 静的エクスポート時や `matchMedia` 非対応環境（jsdom）では false（通常幅）を返す。
 */
function subscribeNarrowViewport(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mql = window.matchMedia(NARROW_MEDIA_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getNarrowViewportSnapshot() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(NARROW_MEDIA_QUERY).matches
}

function getNarrowViewportServerSnapshot() {
  return false
}

function useIsNarrowViewport() {
  return useSyncExternalStore(
    subscribeNarrowViewport,
    getNarrowViewportSnapshot,
    getNarrowViewportServerSnapshot,
  )
}

interface ProbabilityChartProps {
  successRatePercent: number
  confidencePercent: number
  /**
   * テスト用の固定幅（px）。`width` / `height` の両方を指定した場合のみ固定サイズで描画する。
   * 未指定時は親要素の幅に追従するレスポンシブ描画（jsdom では親幅が 0 のため描画されない）。
   */
  width?: number
  /** テスト用の固定高さ（px）。`width` と併せて指定する */
  height?: number
}

/**
 * 試行回数 N に対する累積成功確率 1-(1-p)^N の折れ線グラフ。
 * 信頼度の水平線と、信頼度が既定値（90%）でなければ 90% の線も描く。
 * 計算できないときは、何も描かずに済ませず、エラー文言を表示する。
 *
 * テストで幅・高さを固定値で渡せるようにしているのは、jsdom では要素の幅が 0 になり描画されないため
 * （recharts issue #1423）。ResizeObserver をモックする方法は、recharts の内部実装に依存するため採らない。
 */
export function ProbabilityChart({
  successRatePercent,
  confidencePercent,
  width,
  height,
}: ProbabilityChartProps) {
  const isNarrow = useIsNarrowViewport()
  const isFixedSize = width !== undefined && height !== undefined
  // v.parse は throw してレンダーごと落ちるため、変換も含めてすべて Result で扱う
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

  // 信頼度が 90% のときは線が重なるため描かない
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
          {...(isFixedSize
            ? { width, height }
            : {
              responsive: true,
              width: '100%',
              height: isNarrow ? NARROW_CHART_HEIGHT : CHART_HEIGHT,
            })}
          data={data}
          margin={{
            top: 16,
            right: isNarrow ? NARROW_CHART_MARGIN_RIGHT : CHART_MARGIN_RIGHT,
            bottom: 32,
            left: 16,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="trialCount"
            type="number"
            domain={[1, upperBound]}
            tickFormatter={formatCount}
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
      // role="img" にすると子孫のテキストが読み上げられないため、通常のテキストにする（Issue #25）。
      // 計算結果側の表示で通知済みのため、role="status" も付けない
      <p data-testid="probability-chart-error" className="text-muted-foreground mt-4 text-sm">
        グラフを描画できません:
        {' '}
        {formatDomainError(error)}
      </p>
    ),
  )
}
