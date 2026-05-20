import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import Home from './page'

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
    expect(screen.getByLabelText('成功率')).toBeInTheDocument()
  })

  it('逆算タブをクリックすると aria-selected が逆算側に切替わる', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '逆算' }))
    expect(screen.getByRole('tab', { name: '逆算' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '順算' })).toHaveAttribute('aria-selected', 'false')
  })

  it('逆算タブを選択すると試行回数フィールドが描画される', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: '逆算' }))
    expect(await screen.findByLabelText('試行回数')).toBeInTheDocument()
  })
})
