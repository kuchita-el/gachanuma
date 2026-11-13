import { valibotResolver } from '@hookform/resolvers/valibot'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import * as v from 'valibot'
import { describe, expect, it, vi } from 'vitest'

import { Form } from '@/components/ui/form'
import { NumberInputField } from '@/components/number-input-field'

const rateSchema = v.pipe(
  v.string(),
  v.check((s) => {
    const n = Number(s)
    return !Number.isNaN(n) && n > 0
  }, '0より大きい数値を指定してください'),
)

function Harness({ defaultValue = '' }: { defaultValue?: string }) {
  const form = useForm({
    resolver: valibotResolver(v.object({ rate: rateSchema })),
    mode: 'onBlur',
    defaultValues: { rate: defaultValue },
  })
  return (
    <Form {...form}>
      <NumberInputField
        name="rate"
        control={form.control}
        label="成功率"
        suffix="%"
        helperText="0より大きく100未満の数値を入力してください"
        inputMode="decimal"
      />
    </Form>
  )
}

describe('NumberInputField', () => {
  it('label / suffix / helperText が DOM に描画される', () => {
    render(<Harness />)
    expect(screen.getByLabelText('成功率')).toBeInTheDocument()
    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText('0より大きく100未満の数値を入力してください')).toBeInTheDocument()
  })

  it('type="text" 固定で inputMode / autocomplete=off が Input に付与される（Issue #13）', () => {
    render(<Harness />)
    const input = screen.getByLabelText('成功率')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('autocomplete', 'off')
    // type="text" では無意味なため step / min / max は付与しない（値域は Valibot スキーマが担う）
    expect(input).not.toHaveAttribute('step')
    expect(input).not.toHaveAttribute('min')
    expect(input).not.toHaveAttribute('max')
  })

  it('全角数字や記号もそのまま入力値として保持される（正規化はスキーマ側の責務）', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('成功率') as HTMLInputElement
    await user.type(input, '１２．５')
    expect(input.value).toBe('１２．５')
  })

  it('初期描画では aria-invalid=false で helperText のみが aria-describedby に紐づく', () => {
    render(<Harness />)
    const input = screen.getByLabelText('成功率')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    const ids = input.getAttribute('aria-describedby')!.split(' ')
    expect(ids).toHaveLength(1)
    expect(document.getElementById(ids[0]!)).toHaveTextContent('0より大きく100未満の数値を入力してください')
  })

  it('不正値を入力 + blur すると aria-invalid=true とエラー文言が表示される', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('成功率')
    await user.type(input, '0')
    await user.tab()
    expect(await screen.findByText('0より大きい数値を指定してください')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2)
  })

  it('defaultValue を渡すと初期値が反映され、ユーザー入力で双方向同期する', async () => {
    const user = userEvent.setup()
    render(<Harness defaultValue="50" />)
    const input = screen.getByLabelText('成功率') as HTMLInputElement
    expect(input.value).toBe('50')
    await user.clear(input)
    await user.type(input, '75')
    expect(input.value).toBe('75')
  })

  it('複数フィールド + ネストパスでも各 NumberInputField が独立に描画される', () => {
    type MultiForm = {
      successRate: string
      trial: { count: string }
    }
    function MultiHarness() {
      const form = useForm<MultiForm>({
        defaultValues: { successRate: '', trial: { count: '' } },
      })
      return (
        <Form {...form}>
          <NumberInputField
            name="successRate"
            control={form.control}
            label="成功率"
            suffix="%"
            helperText="0より大きく100未満の数値を入力してください"
            inputMode="decimal"
          />
          <NumberInputField
            name="trial.count"
            control={form.control}
            label="試行回数"
            suffix="回"
            helperText="1以上の整数を入力してください"
            inputMode="numeric"
          />
        </Form>
      )
    }
    render(<MultiHarness />)
    expect(screen.getByLabelText('成功率')).toBeInTheDocument()
    expect(screen.getByLabelText('試行回数')).toBeInTheDocument()
  })

  it('<Form> ラップなしでレンダーすると throw する (useFormContext 不在検出)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BareHarness() {
      const form = useForm({ defaultValues: { rate: '' } })
      return (
        <NumberInputField
          name="rate"
          control={form.control}
          label="成功率"
          suffix="%"
          helperText="0より大きく100未満の数値を入力してください"
          inputMode="decimal"
        />
      )
    }
    expect(() => render(<BareHarness />)).toThrow()
    errorSpy.mockRestore()
  })
})
