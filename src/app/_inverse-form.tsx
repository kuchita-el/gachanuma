'use client'

import {
  percentToRatio,
  probabilityPercentageSchema,
  trialCountInputSchema,
} from '@/probability/probability'
import { calculateCumulativeSuccessProbability } from '@/probability/calculator'
import { formatDomainError } from '@/probability/domain-error'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { NumberInputField } from '@/components/number-input-field'
import { useFormErrorMessage } from '@/lib/use-form-error-message'
import { useThrowToErrorBoundary } from '@/lib/use-throw-to-error-boundary'

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

  const [result, setResult] = useState<{
    cumulativeProbabilityRatio: number
    trialCount: number
  }>()
  const [calculationError, setCalculationError] = useFormErrorMessage(subscribe)
  const throwToErrorBoundary = useThrowToErrorBoundary()

  const onSubmit = handleSubmit((form) => {
    try {
      const calcResult = calculateCumulativeSuccessProbability(
        percentToRatio(Number(form.successRate)),
        Number(form.trialCount),
      )
      calcResult.match(
        (value) => {
          setResult({
            cumulativeProbabilityRatio: value,
            trialCount: Number(form.trialCount),
          })
          setCalculationError(undefined)
        },
        (error) => {
          setResult(undefined)
          setCalculationError(formatDomainError(error))
        },
      )
    }
    catch (e) {
      throwToErrorBoundary(e)
    }
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

      {result !== undefined && (
        <div
          role="status"
          aria-live="polite"
          aria-label="計算結果"
          className="bg-primary/10 mt-8 rounded-lg p-6"
        >
          <h2 className="mb-2 text-lg font-semibold">計算結果</h2>
          <p className="text-3xl font-bold">
            {(result.cumulativeProbabilityRatio * 100).toFixed(2)}
            %
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.trialCount}
            回試行したとき少なくとも1回成功する確率
          </p>
        </div>
      )}

      {calculationError && (
        <Alert
          variant="destructive"
          role="alert"
          aria-live="assertive"
          className="mt-4"
        >
          <AlertDescription>{calculationError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
