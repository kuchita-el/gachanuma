'use client'

import { probabilityPercentageSchema } from '@/probability/probability'
import { calculateTrialCountFromPercent } from '@/probability/calculator'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  successRate: probabilityPercentageSchema,
})

export default function Home() {
  const { handleSubmit, control } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      successRate: '',
    },
  })

  const [trialCount, setTrialCount] = useState<number>()
  const [calculationError, setCalculationError] = useState<string>()

  const onSubmit = handleSubmit((form) => {
    try {
      const result = calculateTrialCountFromPercent(Number(form.successRate))
      setTrialCount(result)
      setCalculationError(undefined)
    }
    catch (error) {
      setTrialCount(undefined)
      setCalculationError(error instanceof Error ? error.message : '計算エラーが発生しました。')
    }
  })

  return (
    <Box sx={{
      marginTop: 8,
    }}
    >
      <form onSubmit={onSubmit}>
        <Controller
          name="successRate"
          control={control}
          render={({ field, formState: { errors } }) => (
            <>
              <TextField
                label="成功率"
                error={!!errors.successRate?.message}
                helperText={errors.successRate?.message || '0より大きく100未満の数値を入力してください'}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  },
                  htmlInput: {
                    'aria-describedby': 'success-rate-helper-text',
                    'inputMode': 'decimal',
                    'type': 'number',
                    'step': 'any',
                  },
                }}
                fullWidth
                {...field}
              />
            </>
          )}
        >
        </Controller>
        <Button variant="contained" type="submit">計算</Button>
      </form>
      {trialCount !== undefined && (
        <Box
          sx={{
            marginTop: 4,
            padding: 3,
            backgroundColor: 'primary.light',
            borderRadius: 2,
          }}
          role="status"
          aria-live="polite"
          aria-label="計算結果"
        >
          <Typography variant="h6" component="h2" gutterBottom>
            計算結果
          </Typography>
          <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>
            {trialCount}
            回
          </Typography>
          <Typography variant="body2" sx={{ marginTop: 1, color: 'text.secondary' }}>
            90%の確率で成功するために必要な試行回数
          </Typography>
        </Box>
      )}
      {calculationError && (
        <Box
          sx={{
            marginTop: 2,
            padding: 2,
            backgroundColor: 'error.light',
            borderRadius: 2,
            color: 'error.contrastText',
          }}
          role="alert"
          aria-live="assertive"
        >
          <Typography variant="body1">
            {calculationError}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
