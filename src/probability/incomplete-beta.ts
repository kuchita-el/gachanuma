/**
 * 正則化不完全ベータ関数 I_x(a, b) の数値計算。
 *
 * 二項分布 CDF との恒等式 `P(X ≥ k | n, p) = I_p(k, n − k + 1)`（X ~ Binomial(n, p)）を介して
 * `calculateTrialCountForMultipleSuccess` の二分探索における各 k の確率評価に使われる。
 * 実装は Numerical Recipes §6.4 の連続分数展開（Lentz 法）で、x の値域に応じて収束領域を
 * 切り替え、`gammln`（対数ガンマ）でオーバーフローを回避する。
 *
 * `gammln` は Lanczos g=7・係数 9 項の高精度版。NR2 の 6 項版は exact-threshold
 * （`I_0.5(a,a)=0.5`）での誤差が a=10 で 4e-12、a=100 で 3e-11 に達し、本モジュールの
 * 呼び出し側が採用する ε=1e-12 の閾値許容誤差を超える。9 項版は a=100 でも誤差 ~1e-13 で
 * 余裕を持って吸収できる。
 */

const MAXIT = 300
const EPS = 3e-16
const FPMIN = 1e-300

function gammln(z: number): number {
  const cof = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  const zm = z - 1
  let x = cof[0]!
  for (let i = 1; i < 9; i++) {
    x += cof[i]! / (zm + i)
  }
  const t = zm + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (zm + 0.5) * Math.log(t) - t + Math.log(x)
}

function betacf(a: number, b: number, x: number): number {
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/**
 * 正則化不完全ベータ関数 I_x(a, b)。
 *
 * 性質:
 * - 0 ≤ I_x(a, b) ≤ 1
 * - x に対し単調非減少
 * - I_0(a, b) = 0、I_1(a, b) = 1
 * - 対称恒等式 I_x(a, b) + I_{1-x}(b, a) = 1
 *
 * 二項 CDF との同等性: `P(Bin(n, p) ≥ k) = I_p(k, n − k + 1)`。
 *
 * @param a - 第一形状パラメタ（> 0）
 * @param b - 第二形状パラメタ（> 0）
 * @param x - 評価点（0 ≤ x ≤ 1）
 */
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a
  return 1 - bt * betacf(b, a, 1 - x) / b
}
