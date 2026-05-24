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

type NumberInputFieldProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>
  control: Control<TFieldValues>
  label: string
  suffix: string
  helperText: string
} & Omit<React.ComponentProps<'input'>, 'name'>

function NumberInputField<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  suffix,
  helperText,
  className,
  ...inputProps
}: NumberInputFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
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
