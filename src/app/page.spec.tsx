import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import Home from './page'

/**
 * 表示中のタブパネルを返す。
 * 両タブとも forceMount で常にマウントされ（Issue #10）、非アクティブ側は CSS（display:none）で隠すが、
 * jsdom は Tailwind の CSS を解釈しないため、data-state で表示中のパネルを特定してスコープを絞る。
 */
function activePanel() {
  const panel = screen
    .getAllByRole('tabpanel')
    .find(el => el.getAttribute('data-state') === 'active')
  if (!panel) throw new Error('表示中のタブパネルが見つかりません')
  return within(panel)
}

describe('Home (タブUI)', () => {
  it('タブ「必要な回数」「成功する確率」が role=tab で描画される（Issue #18）', () => {
    render(<Home />)
    expect(screen.getByRole('tab', { name: '必要な回数' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '成功する確率' })).toBeInTheDocument()
  })

  it('ページ冒頭に、何を計算するアプリかを説明するリード文がある（Issue #18）', () => {
    render(<Home />)
    expect(
      screen.getByText('ガチャなどの成功率から、目標の確率で成功するまでに必要な回数や、決まった回数で成功する確率を計算します。'),
    ).toBeInTheDocument()
  })

  it('「計算の前提」は折りたたまれた状態で表示され、開くと試行の独立性と天井の扱いが読める（Issue #18）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    const summary = screen.getByText('計算の前提')
    const details = summary.closest('details')!
    expect(details).not.toHaveAttribute('open')
    await user.click(summary)
    expect(details).toHaveAttribute('open')
    expect(within(details).getByText('各試行は互いに独立で、成功率は毎回同じとして計算します。')).toBeInTheDocument()
    expect(within(details).getByText(/天井すり抜け率 0% は天井で必ず成功、100% は天井がないのと同じです。/)).toBeInTheDocument()
  })

  it('初期表示では順算タブが選択状態（aria-selected=true）', () => {
    render(<Home />)
    expect(screen.getByRole('tab', { name: '必要な回数' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '成功する確率' })).toHaveAttribute('aria-selected', 'false')
  })

  it('初期表示で順算側の成功率ラベルが見える', () => {
    render(<Home />)
    expect(activePanel().getByLabelText('成功率')).toBeInTheDocument()
    expect(activePanel().getByLabelText('目標成功回数')).toBeInTheDocument()
  })

  it('逆算タブをクリックすると aria-selected が逆算側に切替わる', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '成功する確率' }))
    expect(screen.getByRole('tab', { name: '成功する確率' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '必要な回数' })).toHaveAttribute('aria-selected', 'false')
  })

  it('逆算タブを選択すると表示中のパネルに試行回数フィールドが描画される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '成功する確率' }))
    expect(activePanel().getByLabelText('試行回数')).toBeInTheDocument()
  })

  it('非アクティブ側のタブパネルは data-state=inactive と非表示クラスを持つ', () => {
    render(<Home />)
    const inactive = screen
      .getAllByRole('tabpanel')
      .filter(el => el.getAttribute('data-state') === 'inactive')
    expect(inactive).toHaveLength(1)
    expect(inactive[0]).toHaveClass('data-[state=inactive]:hidden')
  })

  it('順算で計算した入力値と結果は、タブを往復（逆算→順算）しても保持される（Issue #10）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(activePanel().getByLabelText('成功率'), '50')
    await user.click(activePanel().getByRole('button', { name: '計算' }))
    expect(await activePanel().findByRole('status', { name: '計算結果' })).toHaveTextContent('4回')

    await user.click(screen.getByRole('tab', { name: '成功する確率' }))
    await user.click(screen.getByRole('tab', { name: '必要な回数' }))

    expect(activePanel().getByRole('status', { name: '計算結果' })).toHaveTextContent('4回')
    expect((activePanel().getByLabelText('成功率') as HTMLInputElement).value).toBe('50')
  })

  it('逆算の入力値と結果も、タブを往復（順算→逆算）しても保持される（Issue #10）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '成功する確率' }))
    await user.type(activePanel().getByLabelText('成功率'), '50')
    await user.type(activePanel().getByLabelText('試行回数'), '4')
    await user.click(activePanel().getByRole('button', { name: '計算' }))
    expect(await activePanel().findByRole('status', { name: '計算結果' })).toHaveTextContent('93.75%')

    await user.click(screen.getByRole('tab', { name: '必要な回数' }))
    await user.click(screen.getByRole('tab', { name: '成功する確率' }))

    expect(activePanel().getByRole('status', { name: '計算結果' })).toHaveTextContent('93.75%')
    expect((activePanel().getByLabelText('試行回数') as HTMLInputElement).value).toBe('4')
  })

  it('各タブの成功率は独立して保持される（共有しない）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(activePanel().getByLabelText('成功率'), '50')
    await user.click(screen.getByRole('tab', { name: '成功する確率' }))
    expect((activePanel().getByLabelText('成功率') as HTMLInputElement).value).toBe('')
  })
})
