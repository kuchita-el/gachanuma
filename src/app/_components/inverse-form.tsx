'use client'

import {
  percentToRatio,
  probabilityPercentageSchema,
  trialCountInputSchema,
} from './form-schemas'
import { calculateCumulativeSuccessProbability } from '@/probability/cumulative-probability'
import { validProbabilityRatioSchema, validTrialCountSchema } from '@/probability/value-types'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useForm } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { NumberInputField } from '@/components/number-input-field'
import { ResultPanel } from './result-panel'
import { useCalculation } from '@/lib/use-calculation'

const schema = v.object({
  successRate: probabilityPercentageSchema,
  trialCount: trialCountInputSchema,
})

export function InverseForm() {
  const form = useForm({
    resolver: valibotResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      successRate: '',
      trialCount: '',
    },
  })
  const { handleSubmit, control, subscribe } = form

  const calc = useCalculation<{
    cumulativeProbabilityRatio: number
    trialCount: number
  }>(subscribe)

  const onSubmit = handleSubmit((form) => {
    const trialCount = Number(form.trialCount)
    // 計算呼び出し（v.parse のブランド化含む）はサンク内に置き run の try で捕捉させる（詳細は useCalculation の JSDoc）。
    calc.run(() =>
      calculateCumulativeSuccessProbability(
        v.parse(validProbabilityRatioSchema, percentToRatio(Number(form.successRate))),
        v.parse(validTrialCountSchema, trialCount),
      ).map(value => ({
        cumulativeProbabilityRatio: value,
        trialCount,
      })),
    )
  })

  return (
    <div>
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <NumberInputField
            control={control}
            name="successRate"
            label="成功率"
            suffix="%"
            helperText="0より大きく100未満の数値を入力してください"
            inputMode="decimal"
            type="number"
            step="any"
          />

          <NumberInputField
            control={control}
            name="trialCount"
            label="試行回数"
            suffix="回"
            helperText="1以上の整数を入力してください"
            inputMode="numeric"
            type="number"
            className="mt-4"
          />

          <Button type="submit" className="mt-4">
            計算
          </Button>
        </form>
      </Form>

      {calc.status === 'success' && (
        <ResultPanel className="mt-8">
          <p className="text-3xl font-bold">
            {(calc.result.cumulativeProbabilityRatio * 100).toFixed(2)}
            %
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {calc.result.trialCount}
            回試行したとき少なくとも1回成功する確率
          </p>
        </ResultPanel>
      )}

      {calc.status === 'error' && (
        <Alert
          variant="destructive"
          role="alert"
          aria-live="assertive"
          className="mt-4"
        >
          <AlertDescription>{calc.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
