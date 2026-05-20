'use client'

import {
  confidencePercentageSchema,
  percentToRatio,
  probabilityPercentageSchema,
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
  confidence: confidencePercentageSchema,
})

const CONFIDENCE_PRESETS = [50, 75, 90, 95, 99] as const

export function ForwardForm() {
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: valibotResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      successRate: '',
      confidence: '90',
    },
  })

  const [result, setResult] = useState<{ trialCount: number, confidencePercent: number }>()
  const [calculationError, setCalculationError] = useState<string>()
  const successRateId = useId()
  const successRateHelperId = useId()
  const confidenceId = useId()
  const confidenceHelperId = useId()

  const onSubmit = handleSubmit((form) => {
    const calcResult = tryCalculateTrialCount(
      percentToRatio(Number(form.successRate)),
      percentToRatio(Number(form.confidence)),
    )
    if (calcResult.ok) {
      setResult({ trialCount: calcResult.value, confidencePercent: Number(form.confidence) })
      setCalculationError(undefined)
    }
    else {
      setResult(undefined)
      setCalculationError(calcResult.message)
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
          name="confidence"
          control={control}
          render={({ field, formState: { errors } }) => {
            const errorMessage = errors.confidence?.message
            return (
              <div className="mt-4 space-y-2">
                <Label htmlFor={confidenceId}>信頼度</Label>
                <div className="flex flex-wrap gap-2">
                  {CONFIDENCE_PRESETS.map((preset) => {
                    const selected = field.value === String(preset)
                    return (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        aria-pressed={selected}
                        onClick={() => setValue('confidence', String(preset), { shouldValidate: true })}
                      >
                        {preset}
                        %
                      </Button>
                    )
                  })}
                </div>
                <div className="relative">
                  <Input
                    id={confidenceId}
                    inputMode="numeric"
                    type="number"
                    aria-describedby={confidenceHelperId}
                    aria-invalid={!!errorMessage}
                    className="pr-8"
                    {...field}
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
                <p
                  id={confidenceHelperId}
                  className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {errorMessage || '0より大きく100未満の整数を入力してください'}
                </p>
              </div>
            )
          }}
        />

        {/* disabled は信頼度起因のみ。成功率 0/100 は既存の submit→aria-invalid フローで処理する */}
        <Button type="submit" className="mt-4" disabled={!!errors.confidence}>
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
            {result.trialCount}
            回
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.confidencePercent}
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
