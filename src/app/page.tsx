'use client';

import { Box, Button, InputAdornment, TextField } from "@mui/material";
import { ChangeEvent, useState } from "react";

type ProbabilityFormState = {
  form: {
    successRate: {
      value: string,
      message: string | null,
    }
  }
  trialCount: number | null,
}

export default function Home() {
  const [state, setState] = useState<ProbabilityFormState>({
    form: {
      successRate: {
        value: '',
        message: null,
      },
    },
    trialCount: null,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    const validatedResult = validate(value);
    setState({
      form: {
        successRate: {
          value,
          message: validatedResult
        },
      },
      trialCount: null,
    })
  };

  const handleCalculation = () => {
    setState({
      form: {
        successRate: state.form.successRate
      },
      trialCount: calculateTrialCount(Number(state.form.successRate.value) / 100),
    });
  };

  const hasError = (): boolean => {
    return state.form.successRate.message !== null;
  }

  const trialCount = () => {
    if (state.trialCount === null) return "";
    return Math.round(state.trialCount).toString();
  }

  return (
    <Box component="form" sx={{
      marginTop: 8
    }}>
      <TextField
        label="成功率"
        error={hasError()}
        helperText={state.form.successRate.message}
        value={state.form.successRate.value}
        InputProps={{
          endAdornment: <InputAdornment position="end">%</InputAdornment>,
        }}
        onChange={handleChange}
      />
      <Button variant="contained" onClick={handleCalculation}>計算</Button>
      <div className={"result"}>{trialCount()}</div>
    </Box>
  );
}

const validate = (value: any): null | string => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return "数値を入力してください。"
  } else if (num <= 0) {
    return "0より大きい数値を入力してください。"
  } else if (num > 100) {
    return "100以下の数値を入力してください。"
  }
  return null;
};

const calculateTrialCount = (successRate: number): number => {
  const failureRate = 1 - successRate;
  return Math.ceil(-1 / Math.log10(failureRate));
}


