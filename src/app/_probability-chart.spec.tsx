import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProbabilityChart } from './_probability-chart'

describe('ProbabilityChart', () => {
  it('SVG 要素が DOM に存在する（jsdom 互換、固定サイズ描画）', () => {
    const { container } = render(
      <ProbabilityChart successRatePercent={50} confidencePercent={90} />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('横軸ラベル「試行回数」が DOM に存在する', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={90} />)
    expect(screen.getByText('試行回数')).toBeInTheDocument()
  })

  it('縦軸ラベル「累積成功確率 (%)」が DOM に存在する', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={90} />)
    expect(screen.getByText('累積成功確率 (%)')).toBeInTheDocument()
  })

  it('折れ線が 1 本描画される', () => {
    const { container } = render(
      <ProbabilityChart successRatePercent={50} confidencePercent={90} />,
    )
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1)
  })

  it('Y 軸目盛りに 0/50/100 を含む 3 件以上が描画される', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={90} />)
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1)
  })

  it('信頼度 90 のとき、Y=90 の破線が 1 本描画される（デフォルト90と重複なし）', () => {
    const { container } = render(
      <ProbabilityChart successRatePercent={50} confidencePercent={90} />,
    )
    const dashedLines = container.querySelectorAll('line[stroke-dasharray]')
    expect(dashedLines.length).toBeGreaterThanOrEqual(1)
    // ラベル「90%」
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('信頼度 90 のとき、破線ラベル「90%」のみ（重複描画なし）', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={90} />)
    expect(screen.getAllByText('90%')).toHaveLength(1)
  })

  it('信頼度 50 のとき、破線ラベル「50%」と「90%」（デフォルト線を併記、計 2 本）', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={50} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('信頼度 99 のとき、破線ラベル「99%」と「90%」（デフォルト線を併記）', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={99} />)
    expect(screen.getByText('99%')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('信頼度 50 のとき、破線が 2 本描画される（主補助線 + デフォルト 90）', () => {
    const { container } = render(
      <ProbabilityChart successRatePercent={50} confidencePercent={50} />,
    )
    const dashedLines = container.querySelectorAll('line[stroke-dasharray="4 4"]')
    // 主補助線(c) と デフォルト 90% 線の 2 本
    expect(dashedLines.length).toBeGreaterThanOrEqual(2)
  })

  it('data-testid="probability-chart" のラッパが存在する（E2E用）', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={90} />)
    expect(screen.getByTestId('probability-chart')).toBeInTheDocument()
  })
})
