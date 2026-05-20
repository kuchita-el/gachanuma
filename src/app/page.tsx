'use client'

import {
  DEFAULT_CONFIDENCE,
  percentToRatio,
  probabilityPercentageSchema,
  ratioToPercent,
} from '@/probability/probability'
import { tryCalculateTrialCount } from '@/probability/calculator'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = v.object({
  successRate: probabilityPercentageSchema,
})

export default function Home() {
  const { handleSubmit, control } = useForm({
    resolver: valibotResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      successRate: '',
    },
  })

  const [trialCount, setTrialCount] = useState<number>()
  const [calculationError, setCalculationError] = useState<string>()
  const helperId = useId()

  const onSubmit = handleSubmit((form) => {
    const result = tryCalculateTrialCount(percentToRatio(Number(form.successRate)))
    if (result.ok) {
      setTrialCount(result.value)
      setCalculationError(undefined)
    }
    else {
      setTrialCount(undefined)
      setCalculationError(result.message)
    }
  })

  return (
    <div className="mt-16">
      <form onSubmit={onSubmit}>
        <Controller
          name="successRate"
          control={control}
          render={({ field, formState: { errors } }) => {
            const errorMessage = errors.successRate?.message
            return (
              <div className="space-y-2">
                <Label htmlFor="successRate">成功率</Label>
                <div className="relative">
                  <Input
                    id="successRate"
                    inputMode="decimal"
                    type="number"
                    step="any"
                    aria-describedby={helperId}
                    aria-invalid={!!errorMessage}
                    className="pr-8"
                    {...field}
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
                <p
                  id={helperId}
                  className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {errorMessage || '0より大きく100未満の数値を入力してください'}
                </p>
              </div>
            )
          }}
        />
        <Button type="submit" className="mt-4">計算</Button>
      </form>

      {trialCount !== undefined && (
        <div
          role="status"
          aria-live="polite"
          aria-label="計算結果"
          className="bg-primary/10 mt-8 rounded-lg p-6"
        >
          <h2 className="mb-2 text-lg font-semibold">計算結果</h2>
          <p className="text-3xl font-bold">
            {trialCount}
            回
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {ratioToPercent(DEFAULT_CONFIDENCE)}
            %の確率で成功するために必要な試行回数
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
