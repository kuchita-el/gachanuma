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

  it('ラッパに role="img" と aria-label が付与される', () => {
    render(<ProbabilityChart successRatePercent={50} confidencePercent={90} />)
    const wrapper = screen.getByTestId('probability-chart')
    expect(wrapper).toHaveAttribute('role', 'img')
    expect(wrapper.getAttribute('aria-label')).toMatch(/累積成功確率/)
  })

  it('信頼度補助線の属性が stroke="var(--chart-2)" / strokeWidth=1 / strokeDasharray="4 4"（AC3 機械的検証）', () => {
    const { container } = render(
      <ProbabilityChart successRatePercent={50} confidencePercent={90} />,
    )
    // c=90 で重複回避のため補助線は 1 本だけ。属性は --chart-2
    const refLines = Array.from(
      container.querySelectorAll<SVGLineElement>('line[stroke-dasharray="4 4"]'),
    )
    expect(refLines.length).toBeGreaterThanOrEqual(1)
    const mainRef = refLines[0]!
    expect(mainRef.getAttribute('stroke')).toBe('var(--chart-2)')
    expect(mainRef.getAttribute('stroke-width')).toBe('1')
  })

  it('信頼度 50 のときデフォルト 90% 線の stroke は var(--chart-1)', () => {
    const { container } = render(
      <ProbabilityChart successRatePercent={50} confidencePercent={50} />,
    )
    const refLines = Array.from(
      container.querySelectorAll<SVGLineElement>('line[stroke-dasharray="4 4"]'),
    )
    expect(refLines.length).toBeGreaterThanOrEqual(2)
    // c=50 の主補助線は --chart-2、90% デフォルト線は --chart-1 を含む
    const strokes = refLines.map(el => el.getAttribute('stroke'))
    expect(strokes).toContain('var(--chart-2)')
    expect(strokes).toContain('var(--chart-1)')
  })

  it('successRatePercent が極小（schema 不通過の理論値 1e-15）でも throw せず null フォールバック', () => {
    // Result 型ラッパ経路により CalculationError は ok:false に変換され null が返される
    const { container } = render(
      <ProbabilityChart successRatePercent={1e-15} confidencePercent={90} />,
    )
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('[data-testid="probability-chart"]')).toBeNull()
  })
})
