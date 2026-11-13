'use client'

import {
  confidencePercentageSchema,
  normalizeNumericInput,
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
import { useId, useRef } from 'react'
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
import { useKeepFocusOnPress } from '@/lib/use-keep-focus-on-press'
import { useCalculation } from '@/lib/use-calculation'
import { useScrollIntoViewOnChange } from '@/lib/use-scroll-into-view-on-change'
import { formatCount } from '@/lib/format-number'
import { cn } from '@/lib/utils'

const schema = v.object({
  successRate: probabilityPercentageSchema,
  // 天井 ON 時は使わない値のため省略可能（Issue #12、下の resolver 参照）
  targetCount: v.optional(targetCountInputSchema),
  confidence: confidencePercentageSchema,
  pityEnabled: v.boolean(),
  // 天井 OFF 時はフィールドごと form state から除かれるため省略可能（Issue #80）
  pityCount: v.optional(pityCountInputSchema),
  slipRatePercent: v.optional(slipRatePercentageSchema),
})

const CONFIDENCE_PRESETS = [50, 75, 90, 95, 99] as const

const baseResolver = valibotResolver(schema)

/**
 * 天井 ON 時に目標成功回数を検証対象から外す resolver（Issue #12）。
 *
 * react-hook-form は disabled フィールドの値も resolver に渡す（submit 値から除くのは検証後）ため、
 * disabled にするだけでは、目標成功回数が不正値のまま天井計算をしようとすると検証エラーで送信できない。
 * form state の値は変えないので、天井 OFF に戻すと入力値が復元される。
 *
 * スキーマを v.variant('pityEnabled', ...) で分岐させる案は、フォーム値の型が union になり
 * NumberInputField 等の型付けが複雑になるため採らない。
 */
const resolver: typeof baseResolver = (values, context, options) =>
  baseResolver(
    values.pityEnabled ? { ...values, targetCount: undefined } : values,
    context,
    options,
  )

export function ForwardForm() {
  const form = useForm({
    resolver,
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
  const resultAreaRef = useRef<HTMLDivElement>(null)
  useScrollIntoViewOnChange(resultAreaRef, calc.runCount)
  const submitButtonPressProps = useKeepFocusOnPress()

  const onSubmit = handleSubmit((form) => {
    // 表示用の % は、検証後の比率から戻さず入力値から作る。比率 ×100 は浮動小数点の誤差が出るため
    // （例: 信頼度 7 → 7.000000000000001）。入力値は全角数字や空白を含みうるので正規化してから使う。
    const raw = getValues()
    const normalize = (value: string | number | undefined) =>
      typeof value === 'string' ? normalizeNumericInput(value) : value
    const input = {
      confidence: normalize(raw.confidence),
      targetCount: normalize(raw.targetCount),
      successRate: normalize(raw.successRate),
      pityCount: normalize(raw.pityCount),
      slipRatePercent: normalize(raw.slipRatePercent),
    }
    calc.run(() => {
      let calcResult
      if (form.pityEnabled) {
        // 天井 ON 時は天井フィールドが必ず登録されているため、ここに来ることはない
        if (form.pityCount === undefined || form.slipRatePercent === undefined) {
          throw new Error('天井有効時に天井フィールドの値が存在しません')
        }
        calcResult = calculateTrialCountWithPity(
          form.successRate,
          form.pityCount,
          form.slipRatePercent,
          form.confidence,
        )
      }
      else {
        // 天井 OFF 時は resolver が目標成功回数を検証済みのため、ここに来ることはない
        if (form.targetCount === undefined) {
          throw new Error('天井無効時に目標成功回数の値が存在しません')
        }
        calcResult = calculateTrialCountForMultipleSuccess(
          form.successRate,
          form.targetCount,
          form.confidence,
        )
      }

      // 天井計算は1回成功のみ対応（Issue #34）。入力された目標成功回数で「N回以上成功」と表示しないため
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
            name="targetCount"
            label="目標成功回数"
            suffix="回"
            helperText={
              pityEnabled
                ? '天井を考慮する場合は、目標成功回数は1回で計算します'
                : '何回成功したいかです。1〜100 の整数を入力してください'
            }
            inputMode="numeric"
            className="mt-4"
            // 天井計算は1回成功のみ対応のため、天井 ON 時は入力不可にする。非表示にしないのは
            // 制約を伝えるためと、OFF に戻したとき入力値を復元するため（Issue #12）。
            disabled={pityEnabled}
          />

          <FormField
            control={control}
            name="confidence"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>信頼度</FormLabel>
                {/*
                  ボタン群に名前を付けないと「50%、トグルボタン」とだけ読まれ、何の値か分からない（Issue #25）。
                  Radix の ToggleGroup は未導入で、導入するとスタイルとテストの書き換えが増えるため採らない。
                */}
                <div role="group" aria-label="信頼度のプリセット" className="flex flex-wrap gap-2">
                  {CONFIDENCE_PRESETS.map((preset) => {
                    // 全角入力（"９０"）でもプリセットを選択状態にする（Issue #13）
                    const selected = normalizeNumericInput(String(field.value)) === String(preset)
                    return (
                      <Button
                        key={preset}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        className="h-11 min-w-14"
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
                    {/* type="number" を使わない理由は NumberInputField と同じ（Issue #13） */}
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="pr-8"
                      {...field}
                    />
                  </FormControl>
                </InputAffix>
                <FormDescription>
                  求めた回数以内に目標を達成できる確率です。0より大きく100未満の整数を入力してください
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Controller
            name="pityEnabled"
            control={control}
            render={({ field }) => (
              <div className="mt-2 flex items-center gap-2">
                <Switch
                  id={pityEnabledId}
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    // disabled 中は再検証されないため、ON にする前のエラー表示が残り続けてしまう（Issue #12）
                    if (checked) clearErrors('targetCount')
                  }}
                />
                {/*
                  スイッチ本体は小さいため、ラベルを行いっぱいに広げてタップ領域にする（Issue #20）。
                  ラベルを押すとスイッチが切り替わる。
                */}
                <Label htmlFor={pityEnabledId} className="min-h-11 flex-1 cursor-pointer">
                  天井を考慮する
                </Label>
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
                helperText="この回数目の試行で、目的のものが確定します。1以上の整数を入力してください"
                inputMode="numeric"
                className="mt-4"
                // 天井 OFF 時に、非表示の天井フィールドの不正値で計算できなくなるのを防ぐ（Issue #80）
                shouldUnregister
              />

              <NumberInputField
                control={control}
                name="slipRatePercent"
                label="天井すり抜け率"
                suffix="%"
                helperText="天井で目的のもの以外が出る確率です。0% なら天井で必ず成功し、100% なら天井なしと同じです。0以上100以下の数値を入力してください"
                inputMode="decimal"
                className="mt-4"
                shouldUnregister
              />
            </>
          )}

          {/*
            不正な入力があっても disabled にしない（Issue #21）。disabled のボタンはフォーカスできず、
            押せない理由が伝わらないため。押すと react-hook-form が最初のエラーフィールドへフォーカスを移す。
          */}
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
              {formatCount(calc.result.trialCount)}
              回
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {calc.result.confidencePercent}
              %の確率で
              {calc.result.targetCount >= 2
                ? `${formatCount(calc.result.targetCount)}回以上`
                : '少なくとも1回'}
              成功するために必要な試行回数
            </p>
            {calc.result.pity && (
              <p className="text-muted-foreground mt-1 text-sm">
                天井
                {' '}
                {formatCount(calc.result.pity.pityCount)}
                {' '}
                回・すり抜け率
                {' '}
                {calc.result.pity.slipRatePercent}
                % 込み
              </p>
            )}
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

      {calc.status === 'success' && (
        <div
          data-testid="probability-chart-container"
          className={cn('transition-opacity', calc.stale && 'opacity-50')}
        >
          <ProbabilityChart
            successRatePercent={calc.result.successRatePercent}
            confidencePercent={calc.result.confidencePercent}
          />
        </div>
      )}
    </div>
  )
}
