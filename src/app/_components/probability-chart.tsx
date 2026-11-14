'use client'

import { useId, useMemo, useSyncExternalStore } from 'react'
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Result } from 'neverthrow'
import { computeXAxisRange, sampleTrialCounts } from './chart-range'
import { type ChartMarker, describeChart } from './chart-summary'
import { formatDomainError } from '@/lib/format-domain-error'
import { formatCount, formatProbabilityPercent } from '@/lib/format-number'
import { evaluateSuccessCurve, type SuccessCurve } from '@/probability/success-curve'
import { type TrialCount } from '@/probability/value-types'
import { DEFAULT_CONFIDENCE_PERCENT } from './form-schemas'

const Y_TICKS = [0, 25, 50, 75, 100]

/** 通常幅でのグラフ高さ（px） */
const CHART_HEIGHT = 320
/** 狭い幅（ビューポート 400px 未満）でのグラフ高さ（px） */
const NARROW_CHART_HEIGHT = 260
/** 通常幅での右マージン。X 軸の末尾の目盛り（例: `80,000`）の右半分が切れない幅 */
const CHART_MARGIN_RIGHT = 32
/** 狭い幅での右マージン */
const NARROW_CHART_MARGIN_RIGHT = 24
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

/** ツールチップの見出し（試行回数）の文言（例: 「1,230回」）（Issue #16） */
export function formatTooltipTrialCount(trialCount: number): string {
  return `${formatCount(trialCount)}回`
}

/** ツールチップの値（累積成功確率、%）の文言（例: 「95.12%」）（Issue #16） */
export function formatTooltipPercent(percent: number): string {
  return formatProbabilityPercent(percent / 100)
}

type LabelPosition = 'insideTopLeft' | 'insideTopRight' | 'insideBottomLeft' | 'insideBottomRight'

/**
 * マーカーのラベル位置。曲線と重なりにくく、グラフの端で切れない側を選ぶ。
 * - 縦: 曲線はマーカーより右で上・左で下にあるため、マーカーの確率が高ければ下、低ければ上に置く
 * - 横: マーカーが右半分にあれば縦線の左、左半分にあれば右に置く
 *
 * recharts の inside* は幅 0 の縦線を基準にするため、左右の名前が見た目と逆になる
 * （`insideBottomRight` は縦線の左に置かれる）。
 */
export function markerLabelPosition(
  trialCount: number,
  upperBound: number,
  percent: number,
): LabelPosition {
  const vertical = percent >= 50 ? 'Bottom' : 'Top'
  const horizontal = trialCount > upperBound / 2 ? 'Right' : 'Left'
  return `inside${vertical}${horizontal}`
}

/** グラフの描画データ（X 軸の範囲・目盛り・点列・マーカーの点）を求める */
function computeChartData(curve: SuccessCurve, markerTrialCount: TrialCount) {
  const toPoint = (n: TrialCount) =>
    evaluateSuccessCurve(curve, n).map(ratio => ({
      trialCount: n,
      cumulativeProbabilityPercent: ratio * 100,
    }))

  return Result.combine([
    computeXAxisRange(curve, markerTrialCount),
    toPoint(markerTrialCount),
  ]).andThen(([{ upperBound, ticks }, markerPoint]) =>
    sampleTrialCounts(upperBound).andThen((samples) => {
      // 天井の前後で確率が跳ねるため、天井回数とその直前の点を必ず含め、跳ねる位置を正しく描く。
      // マーカーの点も含め、マーカーが折れ線の上に乗るようにする。
      // 天井回数は整数なので、1 以上・上限以下に絞れば試行回数として妥当な値になる
      const extras = [
        markerTrialCount,
        ...(curve.kind === 'pity' ? [curve.pityCount - 1, curve.pityCount] : []),
      ].filter((n): n is TrialCount => n >= 1 && n <= upperBound)
      const trialCounts = [...new Set([...samples, ...extras])].sort((a, b) => a - b)
      return Result.combine(trialCounts.map(toPoint)).map(points => ({
        upperBound,
        ticks,
        markerPoint,
        // 0 回試行では成功していないため、原点から描く
        data: [{ trialCount: 0, cumulativeProbabilityPercent: 0 }, ...points],
      }))
    }),
  )
}

interface ProbabilityChartProps {
  /** 描く曲線のモデル。計算結果と同じモデルを渡し、グラフと結果を一致させる（Issue #8） */
  curve: SuccessCurve
  /** 信頼度（%）。省略すると信頼度線を描かない（逆算、Issue #17） */
  confidencePercent?: number
  /** 縦線・点・ラベルで示す注目点（順算は計算結果、逆算は入力した試行回数）（Issue #16 / #17） */
  marker: ChartMarker
  /**
   * テスト用の固定幅（px）。`width` / `height` の両方を指定した場合のみ固定サイズで描画する。
   * 未指定時は親要素の幅に追従するレスポンシブ描画（jsdom では親幅が 0 のため描画されない）。
   */
  width?: number
  /** テスト用の固定高さ（px）。`width` と併せて指定する */
  height?: number
}

/**
 * 試行回数に対する累積成功確率の折れ線グラフ。
 * 注目点のマーカー、信頼度の水平線（指定時）、目安の 90% 線（信頼度が 90% のときは重なるため省く）を描く。
 * 計算できないときは、何も描かずに済ませず、エラー文言を表示する。
 *
 * テストで幅・高さを固定値で渡せるようにしているのは、jsdom では要素の幅が 0 になり描画されないため
 * （recharts issue #1423）。ResizeObserver をモックする方法は、recharts の内部実装に依存するため採らない。
 */
export function ProbabilityChart({
  curve,
  confidencePercent,
  marker,
  width,
  height,
}: ProbabilityChartProps) {
  const isNarrow = useIsNarrowViewport()
  const descriptionId = useId()
  const isFixedSize = width !== undefined && height !== undefined

  // 曲線の評価（約 200 点の betai）と到達回数の二分探索は重いため、入力のたびの再描画
  // （結果が古いことを示す stale の更新など）で計算し直さない
  const markerTrialCount = marker.trialCount
  const markerCaption = marker.caption
  const chartResult = useMemo(
    () => computeChartData(curve, markerTrialCount),
    [curve, markerTrialCount],
  )
  const description = useMemo(
    () => describeChart(curve, { trialCount: markerTrialCount, caption: markerCaption }),
    [curve, markerTrialCount, markerCaption],
  )

  const showDefaultGuide = confidencePercent !== DEFAULT_CONFIDENCE_PERCENT

  return chartResult.match(
    ({ upperBound, ticks, markerPoint, data }) => (
      <div className="mt-4">
        <div
          data-testid="probability-chart"
          role="img"
          aria-label="試行回数に対する累積成功確率の折れ線グラフ"
          aria-describedby={descriptionId}
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
              domain={[0, upperBound]}
              ticks={ticks}
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
            {/*
              既定の表示は role="status" を持ち、ホバーのたびに読み上げられるうえ、結果パネルの live region と
              区別できなくなるため、role を持たない独自の表示にする。値は代替テキストの要約で伝える（Issue #25）
            */}
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => {
                const percent = payload?.[0]?.value
                if (!active || typeof percent !== 'number') {
                  return null
                }
                return (
                  <div className="bg-popover text-popover-foreground rounded-md border px-2 py-1 text-xs shadow-sm">
                    {formatTooltipTrialCount(Number(label))}
                    :
                    {' '}
                    {formatTooltipPercent(percent)}
                  </div>
                )
              }}
            />
            {/*
              2本の水平線は色だけでなく線種（実線/破線）と太さでも区別し、凡例の代わりに線ラベルで意味を示す
              （Issue #15）。凡例はモバイル幅で縦の領域を取るため使わない。
              ラベルは、曲線と重ならない側（どちらも線の下。信頼度は右端、目安は左端）に置く。
              inside* は高さ 0 の水平線を基準にするため、上下の名前が見た目と逆になる（insideTop* が線の下）。
            */}
            {showDefaultGuide && (
              <ReferenceLine
                y={DEFAULT_CONFIDENCE_PERCENT}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="4 4"
                label={{
                  value: `目安 ${DEFAULT_CONFIDENCE_PERCENT}%`,
                  position: 'insideTopLeft',
                  fill: 'var(--muted-foreground)',
                  fontSize: 12,
                }}
              />
            )}
            {confidencePercent !== undefined && (
              <ReferenceLine
                y={confidencePercent}
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                label={{
                  value: `信頼度 ${confidencePercent}%`,
                  position: 'insideTopRight',
                  fill: 'var(--chart-2)',
                  fontSize: 12,
                }}
              />
            )}
            <Line
              type="linear"
              dataKey="cumulativeProbabilityPercent"
              name="累積成功確率"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <ReferenceLine
              x={markerPoint.trialCount}
              stroke="var(--chart-2)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              label={{
                value: `${formatCount(markerPoint.trialCount)}回: ${formatProbabilityPercent(markerPoint.cumulativeProbabilityPercent / 100)}`,
                position: markerLabelPosition(
                  markerPoint.trialCount,
                  upperBound,
                  markerPoint.cumulativeProbabilityPercent,
                ),
                fill: 'var(--chart-2)',
                fontSize: 12,
              }}
            />
            <ReferenceDot
              x={markerPoint.trialCount}
              y={markerPoint.cumulativeProbabilityPercent}
              r={5}
              fill="var(--chart-2)"
              stroke="var(--background)"
              strokeWidth={2}
            />
          </LineChart>
        </div>
        <p id={descriptionId} className="sr-only">
          {description}
        </p>
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
