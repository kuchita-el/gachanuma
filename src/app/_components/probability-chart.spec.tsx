import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as v from 'valibot'
import {
  formatTooltipPercent,
  formatTooltipTrialCount,
  markerLabelPosition,
  ProbabilityChart,
} from './probability-chart'
import type { SuccessCurve } from '@/probability/success-curve'
import {
  validPityCountSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
  validTargetCountSchema,
  validTrialCountSchema,
} from '@/probability/value-types'

// jsdom では要素幅が 0 になりレスポンシブ描画されないため、テスト用の固定サイズ props を渡す
const FIXED_SIZE = { width: 600, height: 320 } as const

const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const trial = (n: number) => v.parse(validTrialCountSchema, n)
const single = (p: number): SuccessCurve => ({ kind: 'single', successRate: prob(p) })
const multiple = (p: number, r: number): SuccessCurve =>
  ({ kind: 'multiple', successRate: prob(p), targetCount: v.parse(validTargetCountSchema, r) })
const withPity = (p: number, n: number, m: number): SuccessCurve => ({
  kind: 'pity',
  successRate: prob(p),
  pityCount: v.parse(validPityCountSchema, n),
  slipRate: v.parse(validSlipRateRatioSchema, m),
})
const marker = (n: number, caption = '計算結果') => ({ trialCount: trial(n), caption })

/** 成功率 50%・信頼度 90%・結果 4回（順算の典型例） */
function renderForward(confidencePercent = 90) {
  return render(
    <ProbabilityChart
      {...FIXED_SIZE}
      curve={single(0.5)}
      confidencePercent={confidencePercent}
      marker={marker(4)}
    />,
  )
}

function xTickTexts(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value'))
    .map(el => el.textContent ?? '')
}

function referenceLines(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGLineElement>('.recharts-reference-line line'))
}

describe('ProbabilityChart', () => {
  describe('基本の描画', () => {
    it('SVG・軸ラベル・折れ線 1 本が描画される', () => {
      const { container } = renderForward()
      expect(container.querySelector('svg')).not.toBeNull()
      expect(screen.getByText('試行回数')).toBeInTheDocument()
      expect(screen.getByText('累積成功確率 (%)')).toBeInTheDocument()
      expect(container.querySelectorAll('.recharts-line')).toHaveLength(1)
    })

    it('Y 軸目盛りに 0/50/100 が描画される', () => {
      renderForward()
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1)
    })

    it('主曲線は var(--chart-1) の実線 2.5px（Issue #15）', () => {
      const { container } = renderForward()
      const curve = container.querySelector('.recharts-line-curve')!
      expect(curve.getAttribute('stroke')).toBe('var(--chart-1)')
      expect(curve.getAttribute('stroke-width')).toBe('2.5')
      expect(curve.getAttribute('stroke-dasharray')).toBeNull()
    })
  })

  describe('X 軸の目盛り（Issue #16）', () => {
    it('0 から始まる切りの良い目盛りになる（成功率 1% → 0, 200, 400, 600, 800）', () => {
      const { container } = render(
        <ProbabilityChart {...FIXED_SIZE} curve={single(0.01)} confidencePercent={90} marker={marker(230)} />,
      )
      expect(xTickTexts(container)).toEqual(['0', '200', '400', '600', '800'])
    })

    it('1,000 以上の目盛りは桁区切りで描画される', () => {
      const { container } = render(
        <ProbabilityChart {...FIXED_SIZE} curve={single(0.0001)} confidencePercent={90} marker={marker(23025)} />,
      )
      const largeTicks = xTickTexts(container).filter(t => Number(t.replaceAll(',', '')) >= 1000)
      expect(largeTicks.length).toBeGreaterThanOrEqual(1)
      for (const t of largeTicks) {
        expect(t).toMatch(/^\d{1,3}(,\d{3})+$/)
      }
    })
  })

  describe('参照線（Issue #15）', () => {
    it('信頼度線は var(--chart-2) の実線 1.5px で、ラベル「信頼度 N%」', () => {
      const { container } = renderForward(95)
      expect(screen.getByText('信頼度 95%')).toBeInTheDocument()
      const confidenceLine = referenceLines(container).find(
        l => l.getAttribute('stroke') === 'var(--chart-2)' && l.getAttribute('stroke-dasharray') === null,
      )
      expect(confidenceLine).toBeDefined()
      expect(confidenceLine!.getAttribute('stroke-width')).toBe('1.5')
    })

    it('目安 90% 線は var(--muted-foreground) の破線 1px で、ラベル「目安 90%」', () => {
      const { container } = renderForward(95)
      expect(screen.getByText('目安 90%')).toBeInTheDocument()
      const guide = referenceLines(container).find(l => l.getAttribute('stroke') === 'var(--muted-foreground)')
      expect(guide).toBeDefined()
      expect(guide!.getAttribute('stroke-dasharray')).toBe('4 4')
      expect(guide!.getAttribute('stroke-width')).toBe('1')
    })

    it('信頼度 90% のときは目安線を描かない（線が重なるため）', () => {
      renderForward(90)
      expect(screen.getByText('信頼度 90%')).toBeInTheDocument()
      expect(screen.queryByText('目安 90%')).not.toBeInTheDocument()
    })

    it('信頼度を省略すると信頼度線を描かず、目安 90% 線は描く（逆算、Issue #17）', () => {
      render(<ProbabilityChart {...FIXED_SIZE} curve={single(0.01)} marker={marker(100, '入力した試行回数')} />)
      expect(screen.queryByText(/^信頼度/)).not.toBeInTheDocument()
      expect(screen.getByText('目安 90%')).toBeInTheDocument()
    })
  })

  describe('マーカー（Issue #16 / #17）', () => {
    it('注目点の試行回数と確率をラベルに表示する（成功率 1%・230回 → 「230回: 90.09%」）', () => {
      render(<ProbabilityChart {...FIXED_SIZE} curve={single(0.01)} confidencePercent={90} marker={marker(230)} />)
      expect(screen.getByText('230回: 90.09%')).toBeInTheDocument()
    })

    it('注目点に縦の点線と点を描く', () => {
      const { container } = render(
        <ProbabilityChart {...FIXED_SIZE} curve={single(0.01)} confidencePercent={90} marker={marker(230)} />,
      )
      const vertical = referenceLines(container).find(l => l.getAttribute('stroke-dasharray') === '2 3')
      expect(vertical).toBeDefined()
      expect(vertical!.getAttribute('x1')).toBe(vertical!.getAttribute('x2'))
      expect(container.querySelector('.recharts-reference-dot')).not.toBeNull()
    })

    it('注目点が曲線の 99% 到達より大きくても、X 軸の範囲に入る（成功率 50%・1,000回）', () => {
      const { container } = render(
        <ProbabilityChart {...FIXED_SIZE} curve={single(0.5)} marker={marker(1000, '入力した試行回数')} />,
      )
      expect(screen.getByText('1,000回: 99.99%超')).toBeInTheDocument()
      expect(Number(xTickTexts(container).at(-1)!.replaceAll(',', ''))).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('曲線のモデル（Issue #8）', () => {
    it('複数回成功の曲線で、計算結果の回数のマーカーが信頼度以上の確率になる（成功率 1%・3回以上・90% → 532回）', () => {
      render(<ProbabilityChart {...FIXED_SIZE} curve={multiple(0.01, 3)} confidencePercent={90} marker={marker(532)} />)
      // 単発の曲線なら 532 回で 99.52% になる。複数回成功の曲線なら 90% をわずかに超える
      const label = screen.getByText(/^532回: /).textContent!
      const percent = Number(label.replace('532回: ', '').replace('%', ''))
      expect(percent).toBeGreaterThanOrEqual(90)
      expect(percent).toBeLessThan(91)
    })

    it('天井ありの曲線で、天井回数のマーカーが 100% 近くになる（成功率 1%・天井 100回・すり抜け 0%）', () => {
      render(
        <ProbabilityChart {...FIXED_SIZE} curve={withPity(0.01, 100, 0)} confidencePercent={90} marker={marker(100)} />,
      )
      expect(screen.getByText('100回: 99.99%超')).toBeInTheDocument()
    })
  })

  describe('代替テキスト（Issue #25）', () => {
    it('ラッパは role="img" で、aria-describedby が到達回数の要約を指す', () => {
      render(<ProbabilityChart {...FIXED_SIZE} curve={single(0.01)} confidencePercent={90} marker={marker(230)} />)
      const wrapper = screen.getByRole('img', { name: '試行回数に対する累積成功確率の折れ線グラフ' })
      const description = document.getElementById(wrapper.getAttribute('aria-describedby')!)
      expect(description).toHaveTextContent(
        '成功率1%で少なくとも1回成功する確率のグラフ。50%到達は69回、90%到達は230回、99%到達は459回。計算結果の230回で90.09%。',
      )
    })
  })

  describe('エラー表示', () => {
    it('成功率が極小（1e-17）で曲線を計算できないときは、エラー文言をテキストで表示する', () => {
      const { container } = render(
        <ProbabilityChart {...FIXED_SIZE} curve={single(1e-17)} confidencePercent={90} marker={marker(1)} />,
      )
      expect(container.querySelector('svg')).toBeNull()
      const errorView = screen.getByTestId('probability-chart-error')
      expect(errorView).toHaveTextContent(/グラフを描画できません/)
      expect(errorView).toHaveTextContent(/極端に小さい/)
    })

    it('エラー表示は role="img" を持たず、文言がテキストとして読み上げ対象になる（Issue #25）', () => {
      render(<ProbabilityChart {...FIXED_SIZE} curve={single(1e-17)} confidencePercent={90} marker={marker(1)} />)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })
})

describe('formatTooltipTrialCount / formatTooltipPercent（Issue #16）', () => {
  it('試行回数は桁区切り＋「回」', () => {
    expect(formatTooltipTrialCount(1230)).toBe('1,230回')
  })

  it('確率（%）は計算結果と同じ表記', () => {
    expect(formatTooltipPercent(95.123)).toBe('95.12%')
    expect(formatTooltipPercent(100)).toBe('99.99%超')
    expect(formatTooltipPercent(0)).toBe('0%')
  })
})

describe('markerLabelPosition', () => {
  it.each([
    // recharts の inside* は縦線基準のため、見た目で右に置くときは *Left になる
    [230, 800, 90, 'insideBottomLeft'],
    [700, 800, 90, 'insideBottomRight'],
    [10, 800, 9.5, 'insideTopLeft'],
    [700, 800, 9.5, 'insideTopRight'],
  ] as const)('x=%i / 上限 %i / %f%% → %s', (n, upper, percent, expected) => {
    expect(markerLabelPosition(n, upper, percent)).toBe(expected)
  })
})
