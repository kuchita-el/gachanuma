'use client'

import {
  confidencePercentageSchema,
  pityCountInputSchema,
  probabilityPercentageSchema,
  slipRatePercentageSchema,
  targetCountInputSchema,
} from './form-schemas'
import { calculateTrialCountForMultipleSuccess } from '@/probability/required-trials'
import { calculateTrialCountWithPity } from '@/probability/required-trials-with-pity'
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
  pityCount: pityCountInputSchema,
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
    getValues,
    setValue,
    clearErrors,
    subscribe,
    formState: { errors },
  } = form

  const pityEnabled = useWatch({ control, name: 'pityEnabled' })

  const calc = useCalculation<{
    trialCount: number
    confidencePercent: number
    targetCount: number
    successRatePercent: number
    pity?: { pityCount: number, slipRatePercent: number }
  }>(subscribe)
  const pityEnabledId = useId()

  const onSubmit = handleSubmit((form) => {
    // 計算は schema の branded ratio/count（Output）を直接消費する（Issue #114: 所有モデル(b)、再 parse 廃止）。
    // 計算呼び出しはサンク内に置き run の try で捕捉させる（詳細は useCalculation の JSDoc）。
    //
    // 表示用 percent は getValues() の生入力（Input）から取得する。schema が branded ratio を出力する
    // ため form（Output）側は ratio になっており、ratio→percent の逆変換（×100）は浮動小数点ドリフトを
    // 生む（例: 信頼度 7 → 7.000000000000001）。生入力 percent は厳密なため表示はこちらを使う。
    // 責務分離: 計算 = Output(branded ratio) / 表示 = Input(生 percent)。浮動小数点の全廃は別 Issue で検討。
    const input = getValues()
    calc.run(() => {
      const calcResult = form.pityEnabled
        ? calculateTrialCountWithPity(
          form.successRate,
          form.pityCount,
          form.slipRatePercent,
          form.confidence,
        )
        : calculateTrialCountForMultipleSuccess(
          form.successRate,
          form.targetCount,
          form.confidence,
        )

      // 天井計算は「目的キャラ1個排出」固定（Issue #34）。targetCount は無視されるため、
      // 結果表示の「N個獲得」誤表示を避けるため pityEnabled=true 時は 1 に正規化する。
      return calcResult.map(value => ({
        trialCount: value,
        confidencePercent: Number(input.confidence),
        targetCount: form.pityEnabled ? 1 : Number(input.targetCount),
        successRatePercent: Number(input.successRate),
        pity: form.pityEnabled
          ? {
            pityCount: Number(input.pityCount),
            slipRatePercent: Number(input.slipRatePercent),
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

      {calc.status === 'success' && (
        <ResultPanel className="mt-8">
          <p className="text-3xl font-bold">
            {calc.result.trialCount}
            回
            {calc.result.targetCount >= 2 && (
              <span className="text-muted-foreground ml-2 text-base font-normal">
                （
                {calc.result.targetCount}
                個獲得）
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {calc.result.confidencePercent}
            %の確率で成功するために必要な試行回数
          </p>
          {calc.result.pity && (
            <p className="text-muted-foreground mt-1 text-sm">
              天井
              {' '}
              {calc.result.pity.pityCount}
              {' '}
              回・すり抜け率
              {' '}
              {calc.result.pity.slipRatePercent}
              % 込み
            </p>
          )}
        </ResultPanel>
      )}

      {calc.status === 'success' && (
        <ProbabilityChart
          successRatePercent={calc.result.successRatePercent}
          confidencePercent={calc.result.confidencePercent}
        />
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
