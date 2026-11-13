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
  it('タブ「順算」「逆算」が role=tab で描画される', () => {
    render(<Home />)
    expect(screen.getByRole('tab', { name: '順算' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '逆算' })).toBeInTheDocument()
  })

  it('初期表示では順算タブが選択状態（aria-selected=true）', () => {
    render(<Home />)
    expect(screen.getByRole('tab', { name: '順算' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '逆算' })).toHaveAttribute('aria-selected', 'false')
  })

  it('初期表示で順算側の成功率ラベルが見える', () => {
    render(<Home />)
    expect(activePanel().getByLabelText('成功率')).toBeInTheDocument()
    expect(activePanel().getByLabelText('目標成功回数')).toBeInTheDocument()
  })

  it('逆算タブをクリックすると aria-selected が逆算側に切替わる', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '逆算' }))
    expect(screen.getByRole('tab', { name: '逆算' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '順算' })).toHaveAttribute('aria-selected', 'false')
  })

  it('逆算タブを選択すると表示中のパネルに試行回数フィールドが描画される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '逆算' }))
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

    await user.click(screen.getByRole('tab', { name: '逆算' }))
    await user.click(screen.getByRole('tab', { name: '順算' }))

    expect(activePanel().getByRole('status', { name: '計算結果' })).toHaveTextContent('4回')
    expect((activePanel().getByLabelText('成功率') as HTMLInputElement).value).toBe('50')
  })

  it('逆算の入力値と結果も、タブを往復（順算→逆算）しても保持される（Issue #10）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '逆算' }))
    await user.type(activePanel().getByLabelText('成功率'), '50')
    await user.type(activePanel().getByLabelText('試行回数'), '4')
    await user.click(activePanel().getByRole('button', { name: '計算' }))
    expect(await activePanel().findByRole('status', { name: '計算結果' })).toHaveTextContent('93.75%')

    await user.click(screen.getByRole('tab', { name: '順算' }))
    await user.click(screen.getByRole('tab', { name: '逆算' }))

    expect(activePanel().getByRole('status', { name: '計算結果' })).toHaveTextContent('93.75%')
    expect((activePanel().getByLabelText('試行回数') as HTMLInputElement).value).toBe('4')
  })

  it('各タブの成功率は独立して保持される（共有しない）', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(activePanel().getByLabelText('成功率'), '50')
    await user.click(screen.getByRole('tab', { name: '逆算' }))
    expect((activePanel().getByLabelText('成功率') as HTMLInputElement).value).toBe('')
  })
})
