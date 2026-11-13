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
import { keepFocusOnMouseDown } from '@/lib/keep-focus-on-mouse-down'
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
  // 天井2フィールドは pityEnabled=true のときのみマウントされ、OFF 時は
  // field-level shouldUnregister（NumberInputField 経由）で form state から除去される。
  // 除去後に schema が missing で落ちないよう v.optional() で省略可能にする（Issue #80 / D案）。
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

  const onSubmit = handleSubmit((form) => {
    // 計算は schema の branded ratio/count（Output）を直接消費する（Issue #114: 所有モデル(b)、再 parse 廃止）。
    // 計算呼び出しはサンク内に置き run の try で捕捉させる（詳細は useCalculation の JSDoc）。
    //
    // 表示用 percent は getValues() の生入力（Input）から取得する。schema が branded ratio を出力する
    // ため form（Output）側は ratio になっており、ratio→percent の逆変換（×100）は浮動小数点ドリフトを
    // 生む（例: 信頼度 7 → 7.000000000000001）。生入力 percent は厳密なため表示はこちらを使う。
    // 責務分離: 計算 = Output(branded ratio) / 表示 = Input(生 percent)。浮動小数点の全廃は別 Issue で検討。
    // 生入力は全角数字・前後空白を含み得る（type="text"、Issue #13）ため、スキーマと同じ正規化を経て数値化する。
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
        // v.optional() 化で pityCount/slipRatePercent は branded|undefined になる（Issue #80）。
        // pityEnabled=true 時は天井フィールドが register され値が存在する不変条件のため、ここで
        // narrowing する。万一欠落していれば想定外の異常として投げ、calc.run の catch で error
        // 状態へ変換する（ドメイン上の失敗は Result、例外は想定外の異常のみ。useCalculation の JSDoc 参照）。
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

      // 天井計算は「1回成功」固定（Issue #34）。targetCount は無視されるため、
      // 結果表示の「N回以上成功」誤表示を避けるため pityEnabled=true 時は 1 に正規化する。
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
            helperText="0より大きく100未満の数値を入力してください"
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
                : '1〜100 の整数を入力してください'
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
                <div className="flex flex-wrap gap-2">
                  {CONFIDENCE_PRESETS.map((preset) => {
                    // 全角入力（"９０"）でも該当プリセットを選択状態にするため正規化して比較する（Issue #13）
                    const selected = normalizeNumericInput(String(field.value)) === String(preset)
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
                    {/* NumberInputField と同様に type="text" + inputMode で数値入力を表現する（Issue #13） */}
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
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
                    // disabled 中は再検証されないため、ON にする前のエラー表示が残り続けてしまう（Issue #12）
                    if (checked) clearErrors('targetCount')
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
                className="mt-4"
                // OFF 切替によるアンマウント時に form state から除去し検証対象から外す（Issue #80 / D案）。
                shouldUnregister
              />

              <NumberInputField
                control={control}
                name="slipRatePercent"
                label="天井すり抜け率"
                suffix="%"
                helperText="0以上100以下の数値を入力してください"
                inputMode="decimal"
                className="mt-4"
                // OFF 切替によるアンマウント時に form state から除去し検証対象から外す（Issue #80 / D案）。
                shouldUnregister
              />
            </>
          )}

          {/*
            計算ボタンは常に押せる（Issue #21）。disabled のボタンはフォーカスできず理由が伝わらないため、
            不正入力時は react-hook-form の既定動作（全フィールド検証・最初のエラーフィールドへフォーカス・
            FormMessage 表示）で理由を伝える。
          */}
          <Button
            type="submit"
            className="mt-4"
            onMouseDown={keepFocusOnMouseDown}
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
            aria-live="assertive"
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
