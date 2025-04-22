import { z } from "zod";

export const probabilityRatioSchema = z
    .number({
        invalid_type_error: '数値を指定してください。',
        required_error: '数値を指定してください。'
    })
    .min(0, { message: '0から1までの数値を指定してください。' })
    .max(1, { message: '0から1までの数値を指定してください。' });

export const probabilityPercentageSchema = z
    .coerce
    .number({
        invalid_type_error: '数値を指定してください。',
        required_error: '数値を指定してください。'
    })
    .min(0, { message: '0から100までの数値を指定してください。' })
    .max(100, { message: '0から100までの数値を指定してください。' });
