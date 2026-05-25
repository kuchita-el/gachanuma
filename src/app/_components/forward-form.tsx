'use client'

import {
  confidencePercentageSchema,
  percentToRatio,
  probabilityPercentageSchema,
  slipRatePercentageSchema,
  targetCountInputSchema,
  trialCountInputSchema,
} from './form-schemas'
import { calculateTrialCountForMultipleSuccess } from '@/probability/negative-binomial'
import { calculateTrialCountWithPity } from '@/probability/pity'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validSlipRateRatioSchema,
} from '@/probability/probability'
import { ProbabilityChart } from './probability-chart'
import { ResultPanel } from './result-panel'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { InputAffix } from '@/components/input-affix'
import { NumberInputField } from '@/components/number-input-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCalculation } from '@/lib/use-calculation'

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
  const form = useForm({
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
  const {
    handleSubmit,
    control,
    setValue,
    clearErrors,
    subscribe,
    formState: { errors },
  } = form

  const pityEnabled = useWatch({ control, name: 'pityEnabled' })

  const { result, error: calculationError, run } = useCalculation<{
    trialCount: number
    confidencePercent: number
    targetCount: number
    successRatePercent: number
    pity?: { pityCount: number, slipRatePercent: number }
  }>(subscribe)
  const pityEnabledId = useId()

  const onSubmit = handleSubmit((form) => {
    // 計算呼び出しはサンク内に置く。useCalculation.run が計算呼び出しを try で包み、
    // 想定外例外（DomainError 以外の throw、ブランド化 v.parse の失敗等）を
    // Error Boundary に委譲するため。
    run(() => {
      const successRateRatio = v.parse(validProbabilityRatioSchema, percentToRatio(Number(form.successRate)))
      const confidenceRatio = v.parse(validConfidenceSchema, percentToRatio(Number(form.confidence)))

      const calcResult = form.pityEnabled
        ? calculateTrialCountWithPity(
          successRateRatio,
          Number(form.pityCount),
          v.parse(validSlipRateRatioSchema, percentToRatio(Number(form.slipRatePercent))),
          confidenceRatio,
        )
        : calculateTrialCountForMultipleSuccess(
          successRateRatio,
          Number(form.targetCount),
          confidenceRatio,
        )

      // 天井計算は「目的キャラ1個排出」固定（Issue #34）。targetCount は無視されるため、
      // 結果表示の「N個獲得」誤表示を避けるため pityEnabled=true 時は 1 に正規化する。
      return calcResult.map(value => ({
        trialCount: value,
        confidencePercent: Number(form.confidence),
        targetCount: form.pityEnabled ? 1 : Number(form.targetCount),
        successRatePercent: Number(form.successRate),
        pity: form.pityEnabled
          ? {
            pityCount: Number(form.pityCount),
            slipRatePercent: Number(form.slipRatePercent),
          }
          : undefined,
      }))
    })
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
            name="targetCount"
            label="目標成功回数"
            suffix="回"
            helperText="1〜100 の整数を入力してください"
            inputMode="numeric"
            type="number"
            step="1"
            min="1"
            max="100"
            className="mt-4"
          />

          <FormField
            control={control}
            name="confidence"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>信頼度</FormLabel>
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
                <InputAffix suffix="%">
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      type="number"
                      className="pr-8"
                      {...field}
                    />
                  </FormControl>
                </InputAffix>
                <FormDescription>0より大きく100未満の整数を入力してください</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Controller
            name="pityEnabled"
            control={control}
            render={({ field }) => (
              <div className="mt-4 flex items-center gap-2">
                <Switch
                  id={pityEnabledId}
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    // OFF に切り替える際は天井フィールドの値とエラーをデフォルトに戻す。
                    // 隠れたエラー（schema が pityCount/slipRatePercent を常時検証するため）が
                    // submit を阻害するのを防ぐ。
                    if (!checked) {
                      setValue('pityCount', '100')
                      setValue('slipRatePercent', '0')
                      clearErrors(['pityCount', 'slipRatePercent'])
                    }
                  }}
                />
                <Label htmlFor={pityEnabledId}>天井を考慮する</Label>
              </div>
            )}
          />

          {pityEnabled && (
            <>
              <NumberInputField
                control={control}
                name="pityCount"
                label="天井回数"
                suffix="回"
                helperText="1以上の整数を入力してください"
                inputMode="numeric"
                type="number"
                step="1"
                min="1"
                className="mt-4"
              />

              <NumberInputField
                control={control}
                name="slipRatePercent"
                label="天井すり抜け率"
                suffix="%"
                helperText="0以上100以下の数値を入力してください"
                inputMode="decimal"
                type="number"
                step="any"
                className="mt-4"
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
      </Form>

      {result !== undefined && (
        <ResultPanel className="mt-8">
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
        </ResultPanel>
      )}

      {result !== undefined && (
        <ProbabilityChart
          successRatePercent={result.successRatePercent}
          confidencePercent={result.confidencePercent}
        />
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
