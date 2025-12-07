'use client';

import { probabilityPercentageSchema } from "@/probability/probability";
import { calculateTrialCountFromPercent } from "@/probability/calculator";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, InputAdornment, TextField } from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  successRate: probabilityPercentageSchema
});

export default function Home() {
  const { handleSubmit, control } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      successRate: 0
    }
  });

  const onSubmit = handleSubmit(form => {
    setTrialCount(calculateTrialCountFromPercent(Number(form.successRate)));
  });

  const [trialCount, setTrialCount] = useState<number>()

  return (
    <Box sx={{
      marginTop: 8
    }} >
      <form onSubmit={onSubmit}>
        <Controller name="successRate" control={control} render={({ field, formState: { errors } }) =>
          <>
            <TextField
              label="成功率"
              error={errors.successRate?.message ? true : false}
              helperText={errors.successRate?.message}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }
              }}
              {...field}
            />
          </>
        }></Controller>
        <Button variant="contained" type="submit">計算</Button>
      </form>
      <div className={"result"}>{trialCount}</div>
    </Box >
  );
}
