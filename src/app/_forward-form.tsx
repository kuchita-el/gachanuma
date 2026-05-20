'use client'

import {
  confidencePercentageSchema,
  percentToRatio,
  probabilityPercentageSchema,
  slipRatePercentageSchema,
  targetCountInputSchema,
  trialCountInputSchema,
} from '@/probability/probability'
import { tryCalculateTrialCountForMultipleSuccess } from '@/probability/negative-binomial'
import { tryCalculateTrialCountWithPity } from '@/probability/pity'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const schema = v.object({
  successRate: probabilityPercentageSchema,
  targetCount: targetCountInputSchema,
  confidence: confidencePercentageSchema,
  pityEnabled: v.boolean(),
  pityCount: trialCountInputSchema,
  slipRatePercent: slipRatePercentageSchema,
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
      targetCount: '1',
      confidence: '90',
      pityEnabled: false,
      pityCount: '100',
      slipRatePercent: '0',
    },
  })

  const pityEnabled = useWatch({ control, name: 'pityEnabled' })

  const [result, setResult] = useState<{
    trialCount: number
    confidencePercent: number
    targetCount: number
    pity?: { pityCount: number, slipRatePercent: number }
  }>()
  const [calculationError, setCalculationError] = useState<string>()
  const successRateId = useId()
  const successRateHelperId = useId()
  const targetCountId = useId()
  const targetCountHelperId = useId()
  const confidenceId = useId()
  const confidenceHelperId = useId()
  const pityEnabledId = useId()
  const pityCountId = useId()
  const pityCountHelperId = useId()
  const slipRateId = useId()
  const slipRateHelperId = useId()

  const onSubmit = handleSubmit((form) => {
    const successRateRatio = percentToRatio(Number(form.successRate))
    const confidenceRatio = percentToRatio(Number(form.confidence))

    const calcResult = form.pityEnabled
      ? tryCalculateTrialCountWithPity(
        successRateRatio,
        Number(form.pityCount),
        percentToRatio(Number(form.slipRatePercent)),
        confidenceRatio,
      )
      : tryCalculateTrialCountForMultipleSuccess(
        successRateRatio,
        Number(form.targetCount),
        confidenceRatio,
      )

    if (calcResult.ok) {
      // 天井計算は「目的キャラ1個排出」固定（Issue #34）。targetCount は無視されるため、
      // 結果表示の「N個獲得」誤表示を避けるため pityEnabled=true 時は 1 に正規化する。
      setResult({
        trialCount: calcResult.value,
        confidencePercent: Number(form.confidence),
        targetCount: form.pityEnabled ? 1 : Number(form.targetCount),
        pity: form.pityEnabled
          ? {
            pityCount: Number(form.pityCount),
            slipRatePercent: Number(form.slipRatePercent),
          }
          : undefined,
      })
      setCalculationError(undefined)
    }
    else {
      setResult(undefined)
      setCalculationError(calcResult.message)
    }
  })

  // pityEnabled=true のときは天井計算が targetCount を無視するため、targetCount のエラーは
  // disabled に反映しない（pity 用フィールドのエラーのみで disabled 制御）。
  const submitDisabled
    = !!errors.confidence
      || (pityEnabled
        ? !!errors.pityCount || !!errors.slipRatePercent
        : !!errors.targetCount)

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
          name="targetCount"
          control={control}
          render={({ field, formState: { errors } }) => {
            const errorMessage = errors.targetCount?.message
            return (
              <div className="mt-4 space-y-2">
                <Label htmlFor={targetCountId}>目標成功回数</Label>
                <div className="relative">
                  <Input
                    id={targetCountId}
                    inputMode="numeric"
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    aria-describedby={targetCountHelperId}
                    aria-invalid={!!errorMessage}
                    className="pr-8"
                    {...field}
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    回
                  </span>
                </div>
                <p
                  id={targetCountHelperId}
                  className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {errorMessage || '1〜100 の整数を入力してください'}
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

        <Controller
          name="pityEnabled"
          control={control}
          render={({ field }) => (
            <div className="mt-4 flex items-center gap-2">
              <Switch
                id={pityEnabledId}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <Label htmlFor={pityEnabledId}>天井を考慮する</Label>
            </div>
          )}
        />

        {pityEnabled && (
          <>
            <Controller
              name="pityCount"
              control={control}
              render={({ field, formState: { errors } }) => {
                const errorMessage = errors.pityCount?.message
                return (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={pityCountId}>天井回数</Label>
                    <div className="relative">
                      <Input
                        id={pityCountId}
                        inputMode="numeric"
                        type="number"
                        step="1"
                        min="1"
                        aria-describedby={pityCountHelperId}
                        aria-invalid={!!errorMessage}
                        className="pr-8"
                        {...field}
                      />
                      <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                        回
                      </span>
                    </div>
                    <p
                      id={pityCountHelperId}
                      className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {errorMessage || '1以上の整数を入力してください'}
                    </p>
                  </div>
                )
              }}
            />

            <Controller
              name="slipRatePercent"
              control={control}
              render={({ field, formState: { errors } }) => {
                const errorMessage = errors.slipRatePercent?.message
                return (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={slipRateId}>天井すり抜け率</Label>
                    <div className="relative">
                      <Input
                        id={slipRateId}
                        inputMode="decimal"
                        type="number"
                        step="any"
                        aria-describedby={slipRateHelperId}
                        aria-invalid={!!errorMessage}
                        className="pr-8"
                        {...field}
                      />
                      <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                        %
                      </span>
                    </div>
                    <p
                      id={slipRateHelperId}
                      className={`text-sm ${errorMessage ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {errorMessage || '0以上100以下の数値を入力してください'}
                    </p>
                  </div>
                )
              }}
            />
          </>
        )}

        {/* disabled は信頼度・目標成功回数・天井起因のみ。成功率 0/100 は既存の submit→aria-invalid フローで処理する */}
        <Button
          type="submit"
          className="mt-4"
          disabled={submitDisabled}
        >
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
            {result.targetCount >= 2 && (
              <span className="text-muted-foreground ml-2 text-base font-normal">
                （
                {result.targetCount}
                個獲得）
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.confidencePercent}
            %の確率で成功するために必要な試行回数
          </p>
          {result.pity && (
            <p className="text-muted-foreground mt-1 text-sm">
              天井
              {' '}
              {result.pity.pityCount}
              {' '}
              回・すり抜け率
              {' '}
              {result.pity.slipRatePercent}
              % 込み
            </p>
          )}
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
