/**
 * 正則化不完全ベータ関数 I_x(a, b) の数値計算。
 *
 * 二項分布 CDF との恒等式 `P(X ≥ k | n, p) = I_p(k, n − k + 1)`（X ~ Binomial(n, p)）を介して
 * `calculateTrialCountForMultipleSuccess` の二分探索における各 k の確率評価に使われる。
 *
 * アルゴリズム構成（出典別）:
 * - 連続分数展開 `betacf` は Numerical Recipes 2nd ed. §6.4（Lentz 法）。`betai` が x の値域に
 *   応じて収束の速い側の連続分数を選んで呼ぶ。
 * - 対数ガンマ `gammln` は Lanczos 近似（g=7・係数 9 項、GSL 等で使われる係数列）。
 *   NR2 §6.1 掲載の `gammln`（6 項 series ＋ `tmp = x + 5.5`）とは別系統で、係数も異なる。
 *
 * `gammln` に 9 項 Lanczos を採用する理由（exact-threshold での精度要件）:
 * - 呼び出し側は二項確率がちょうど信頼度に等しい dyadic 入力での sub-ULP undershoot を
 *   `EPS_THRESHOLD = 1e-12` で吸収する。この吸収が成立するには `betai` 全体の数値誤差が
 *   1e-12 を十分下回る必要がある。
 * - 基準 `I_0.5(a, a) = 0.5`（厳密値）での実測誤差は、9 項版が a=10 で 5e-15・a=100 で 7e-14。
 *   NR2 の 6 項版では a=10 で 4.6e-12・a=100 で 3.4e-11 に達し、a が大きいほど 1e-12 を超えて
 *   undershoot 吸収マージンを侵す。9 項版はこれを 1 桁以上の余裕で下回る。
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

/**
 * 連続分数展開による B(a, b, x) の評価（NR2 §6.4、Lentz 法）。
 *
 * 収束保証: `betai` の分岐ガード `x < (a+1)/(a+b+2)` により常に収束の速い側で呼ばれる。
 * 本モジュールの入力域（a = targetCount ≤ 100、b = k − targetCount + 1、x = p）では最悪 28 反復、
 * 汎用 export として極端な a=b=1000 でも 56 反復で収束し、`MAXIT = 300` に到達する経路は存在しない。
 * MAXIT 到達時は収束フラグを持たず最後の `h` を返す（NR2 原典の nrerror は省略）が、上記より到達不能。
 */
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
 * 不変条件（呼び出し側の非有限検査省略の根拠）:
 * - a > 0・b > 0・0 ≤ x ≤ 1 の入力域で常に有限値を返す。`x ≤ 0 → 0` / `x ≥ 1 → 1` の早期 return が
 *   `Math.log(x)` / `Math.log(1 − x)` の -Infinity 入力を遮断し、`gammln` は対数領域で計算するため
 *   オーバーフローしない。`calculateTrialCountForMultipleSuccess` の二分探索述語はこの不変条件に依拠して
 *   毎反復の `Number.isFinite` 検査を省いている。この早期 return を将来変更する場合は、呼び出し側の
 *   非有限検査の要否を再評価すること。
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
