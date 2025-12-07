import { z } from "zod";

/**
 * 計算に使用可能な確率（0より大きく1未満）のZodスキーマ
 * 0と1は除外される
 */
export const validProbabilityRatioSchema = z
    .number({ message: '数値を指定してください。' })
    .gt(0, { message: '成功率は0より大きい値を指定してください。' })
    .lt(1, { message: '成功率は1未満の値を指定してください。' });

/**
 * 確率をパーセンテージ（0-100）で表すZodスキーマ
 * 0より大きく100未満の範囲を許可
 * 文字列からの変換に対応
 */
export const probabilityPercentageSchema = z
    .union([
        z.string().transform((val) => {
            const num = parseFloat(val);
            return isNaN(num) ? val : num;
        }),
        z.number()
    ])
    .pipe(
        z.number({ message: '数値を指定してください。' })
            .gt(0, { message: '0より大きく100未満の数値を指定してください。' })
            .lt(100, { message: '0より大きく100未満の数値を指定してください。' })
    );

/**
 * 検証済みの確率比率型（0より大きく1未満）
 */
export type ValidProbabilityRatio = z.infer<typeof validProbabilityRatioSchema>;
