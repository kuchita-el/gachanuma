'use client'

import {
  probabilityPercentageSchema,
  trialCountInputSchema,
} from './form-schemas'
import { calculateCumulativeSuccessProbability } from '@/probability/cumulative-probability'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { NumberInputField } from '@/components/number-input-field'
import { ResultPanel } from './result-panel'
import { useKeepFocusOnPress } from '@/lib/use-keep-focus-on-press'
import { useCalculation } from '@/lib/use-calculation'
import { useScrollIntoViewOnChange } from '@/lib/use-scroll-into-view-on-change'
import { formatCount, formatProbabilityPercent } from '@/lib/format-number'

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
  const resultAreaRef = useRef<HTMLDivElement>(null)
  useScrollIntoViewOnChange(resultAreaRef, calc.runCount)
  const submitButtonPressProps = useKeepFocusOnPress()

  const onSubmit = handleSubmit((form) => {
    calc.run(() =>
      calculateCumulativeSuccessProbability(
        form.successRate,
        form.trialCount,
      ).map(value => ({
        cumulativeProbabilityRatio: value,
        trialCount: form.trialCount,
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
            helperText="1回の試行で成功する確率です。0より大きく100未満の数値を入力してください"
            inputMode="decimal"
          />

          <NumberInputField
            control={control}
            name="trialCount"
            label="試行回数"
            suffix="回"
            helperText="1以上の整数を入力してください"
            inputMode="numeric"
            className="mt-4"
          />

          <Button
            type="submit"
            size="lg"
            className="mt-6 h-11 w-full text-base"
            {...submitButtonPressProps}
          >
            計算
          </Button>
        </form>
      </Form>

      <div ref={resultAreaRef}>
        {calc.status === 'success' && (
          <ResultPanel
            className="mt-8"
            stale={calc.stale}
            onRecalculate={() => void onSubmit()}
          >
            <p className="text-3xl font-bold">
              {formatProbabilityPercent(calc.result.cumulativeProbabilityRatio)}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatCount(calc.result.trialCount)}
              回試行したとき少なくとも1回成功する確率
            </p>
          </ResultPanel>
        )}
        {calc.status === 'error' && (
          <Alert
            variant="destructive"
            role="alert"
            className="mt-4"
          >
            <AlertDescription>{calc.error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
