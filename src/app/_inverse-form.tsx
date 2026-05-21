'use client'

import {
  percentToRatio,
  probabilityPercentageSchema,
  trialCountInputSchema,
} from '@/probability/probability'
import { tryCalculateCumulativeSuccessProbability } from '@/probability/calculator'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useThrowToErrorBoundary } from '@/lib/use-throw-to-error-boundary'

const schema = v.object({
  successRate: probabilityPercentageSchema,
  trialCount: trialCountInputSchema,
})

export function InverseForm() {
  const { handleSubmit, control } = useForm({
    resolver: valibotResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      successRate: '',
      trialCount: '',
    },
  })

  const [result, setResult] = useState<{
    cumulativeProbabilityRatio: number
    trialCount: number
  }>()
  const [calculationError, setCalculationError] = useState<string>()
  const throwToErrorBoundary = useThrowToErrorBoundary()
  const successRateId = useId()
  const successRateHelperId = useId()
  const trialCountId = useId()
  const trialCountHelperId = useId()

  const onSubmit = handleSubmit((form) => {
    try {
      const calcResult = tryCalculateCumulativeSuccessProbability(
        percentToRatio(Number(form.successRate)),
        Number(form.trialCount),
      )
      if (calcResult.ok) {
        setResult({
          cumulativeProbabilityRatio: calcResult.value,
          trialCount: Number(form.trialCount),
        })
        setCalculationError(undefined)
      }
      else {
        setResult(undefined)
        setCalculationError(calcResult.message)
      }
    }
    catch (e) {
      throwToErrorBoundary(e)
    }
  })

  return (
    <div>
      <form onSubmit={onSubmit}>
        <Controller
          name="successRate"
          control={control}
          render={({ field, formState: { errors } }) => {
            const errorMessage = errors.successRate?.message
            return (
              <div className="space-y-2">
                <Label htmlFor={successRateId}>成功率</Label>
                <div className="relative">
                  <Input
                    id={successRateId}
                    inputMode="decimal"
                    type="number"
                    step="any"
                    aria-describedby={successRateHelperId}
                    aria-invalid={!!errorMessage}
                    className="pr-8"
                    {...field}
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
                <p
                  id={successRateHelperId}
                  className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {errorMessage || '0より大きく100未満の数値を入力してください'}
                </p>
              </div>
            )
          }}
        />

        <Controller
          name="trialCount"
          control={control}
          render={({ field, formState: { errors } }) => {
            const errorMessage = errors.trialCount?.message
            return (
              <div className="mt-4 space-y-2">
                <Label htmlFor={trialCountId}>試行回数</Label>
                <div className="relative">
                  <Input
                    id={trialCountId}
                    inputMode="numeric"
                    type="number"
                    aria-describedby={trialCountHelperId}
                    aria-invalid={!!errorMessage}
                    className="pr-8"
                    {...field}
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    回
                  </span>
                </div>
                <p
                  id={trialCountHelperId}
                  className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {errorMessage || '1以上の整数を入力してください'}
                </p>
              </div>
            )
          }}
        />

        <Button type="submit" className="mt-4">
          計算
        </Button>
      </form>

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
