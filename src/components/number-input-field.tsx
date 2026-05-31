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
  // 条件付きレンダリング箇所でアンマウント時に form state から該当フィールドを除去するための
  // field-level 設定。内部の FormField（Controller ラッパ）へ passthrough する（Issue #80 / D案）。
  shouldUnregister?: boolean
} & Omit<React.ComponentProps<'input'>, 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'>

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
  ...inputProps
}: NumberInputFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      shouldUnregister={shouldUnregister}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <InputAffix suffix={suffix}>
            <FormControl>
              <Input className="pr-8" {...inputProps} {...field} />
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
