'use client'

import * as React from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'

import { InputAffix } from '@/components/input-affix'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

type NumberInputFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
  control: Control<TFieldValues>
  label: string
  suffix: string
  helperText: string
  // true にすると、アンマウント時に form state から値が除かれ、検証の対象外になる（Issue #80）
  shouldUnregister?: boolean
  // react-hook-form にフィールドの無効状態を伝えるため、Input ではなく FormField（Controller）へ渡す。
  // field オブジェクト経由で Input の disabled 属性にも反映される（Issue #12）。
  disabled?: boolean
  // モバイルで表示する仮想キーボードの種類（Issue #13）
  inputMode: 'decimal' | 'numeric'
} & Omit<
  React.ComponentProps<'input'>,
  // step / min / max は type="text" では効かないため受け付けない（値域はスキーマで検証する）
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'type' | 'step' | 'min' | 'max' | 'inputMode' | 'disabled'
>

function NumberInputField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  label,
  suffix,
  helperText,
  className,
  shouldUnregister,
  disabled,
  ...inputProps
}: NumberInputFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      shouldUnregister={shouldUnregister}
      disabled={disabled}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <InputAffix suffix={suffix}>
            <FormControl>
              {/*
                type="number" を使わないのは、ホイール操作で値が変わる、スピナーが単位表示と重なるなどの
                問題があるため（Issue #13）
              */}
              <Input type="text" autoComplete="off" className="pr-8" {...inputProps} {...field} />
            </FormControl>
          </InputAffix>
          <FormDescription>{helperText}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export { NumberInputField }
