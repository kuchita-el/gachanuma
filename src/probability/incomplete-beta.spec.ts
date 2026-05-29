import { describe, it, expect } from 'vitest'
import { betai } from './incomplete-beta'

const TOL = 1e-12
const closeTo = (actual: number, expected: number, tol: number = TOL) =>
  Math.abs(actual - expected) < tol

describe('betai (正則化不完全ベータ)', () => {
  describe('既知値（退化ケース）', () => {
    it('IB1: I_x(1,1) = x', () => {
      expect(closeTo(betai(1, 1, 0.3), 0.3)).toBe(true)
    })

    it('IB2: I_x(1,1) = x（小さい x）', () => {
      expect(closeTo(betai(1, 1, 0.01), 0.01)).toBe(true)
    })

    it('IB3: I_0.5(a,a) = 0.5（a=2）', () => {
      expect(closeTo(betai(2, 2, 0.5), 0.5)).toBe(true)
    })

    it('IB4: I_0.5(a,a) = 0.5（a=10）', () => {
      expect(closeTo(betai(10, 10, 0.5), 0.5)).toBe(true)
    })

    it('IB5: I_p(a,1) = p^a（a=3, p=0.5）', () => {
      expect(closeTo(betai(3, 1, 0.5), 0.125)).toBe(true)
    })
  })

  describe('恒等式', () => {
    it('IB6: 対称恒等式 I_x(a,b) + I_{1-x}(b,a) = 1', () => {
      const sum = betai(3, 5, 0.4) + betai(5, 3, 0.6)
      expect(closeTo(sum, 1)).toBe(true)
    })
  })

  describe('内部分岐の境界（x < (a+1)/(a+b+2) と x > ...）両方で連続性', () => {
    it('IB7: (a=2, b=5) で左右分岐の戻り値が 0..1 の中で単調に並ぶ', () => {
      // (a+1)/(a+b+2) = 3/9 ≈ 0.333。x=0.2 は左分岐、x=0.6 は右分岐
      const left = betai(2, 5, 0.2)
      const right = betai(2, 5, 0.6)
      expect(left).toBeGreaterThan(0)
      expect(left).toBeLessThan(1)
      expect(right).toBeGreaterThan(0)
      expect(right).toBeLessThan(1)
      expect(right).toBeGreaterThan(left)
    })
  })

  describe('端点', () => {
    it('IB6_left: x=0 で 0', () => {
      expect(betai(2, 3, 0)).toBe(0)
    })

    it('IB6_right: x=1 で 1', () => {
      expect(betai(2, 3, 1)).toBe(1)
    })

    it('IB8: x=Number.MIN_VALUE（極小正値）で 0 近傍の有限値', () => {
      const v = betai(2, 3, Number.MIN_VALUE)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1e-100)
    })

    it('IB9: x=1-Number.EPSILON（1 直下）で 1 近傍の有限値', () => {
      const v = betai(2, 3, 1 - Number.EPSILON)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeLessThanOrEqual(1)
      expect(v).toBeGreaterThan(1 - 1e-10)
    })
  })

  describe('値域と単調性', () => {
    it('IB_range: 値域 0 ≤ I_x(a,b) ≤ 1（(a,b) グリッド × x グリッド）', () => {
      const grid = [
        [1, 1], [2, 1], [1, 2], [2, 2], [5, 5], [10, 2], [2, 10],
      ] as const
      const xs = [0.01, 0.25, 0.5, 0.75, 0.99]
      for (const [a, b] of grid) {
        for (const x of xs) {
          const v = betai(a, b, x)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    })

    it('IB_mono: x に対し単調非減少（(a,b)=(3,5)）', () => {
      const xs = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
      const vs = xs.map(x => betai(3, 5, x))
      for (let i = 1; i < vs.length; i++) {
        expect(vs[i]!).toBeGreaterThanOrEqual(vs[i - 1]!)
      }
    })
  })

  describe('任意 (a,b) reference 値（手検算 / 既知二項 CDF）', () => {
    it('IB10: I_0.4(2,3) = 0.5248（手検算: P(Bin(4, 0.4) ≥ 2)）', () => {
      // P(X=2) = 6·0.16·0.36 = 0.3456
      // P(X=3) = 4·0.064·0.6 = 0.1536
      // P(X=4) = 0.0256
      // 合計 0.5248
      expect(closeTo(betai(2, 3, 0.4), 0.5248)).toBe(true)
    })

    it('IB10b: I_0.6(5,3) = 0.4199040（手検算: P(Bin(7, 0.6) ≥ 5)）', () => {
      // P(X=5) = 21·0.07776·0.16 = 0.2612736
      // P(X=6) = 7·0.046656·0.4 = 0.1306368
      // P(X=7) = 0.0279936
      // 合計 0.4199040
      expect(closeTo(betai(5, 3, 0.6), 0.4199040)).toBe(true)
    })

    it('IB11: P(Bin(10, 0.5) ≥ 5) = I_0.5(5, 6) = 638/1024', () => {
      expect(closeTo(betai(5, 6, 0.5), 638 / 1024)).toBe(true)
    })

    it('IB12: P(Bin(10, 0.5) ≥ 1) = I_0.5(1, 10) = 1023/1024', () => {
      expect(closeTo(betai(1, 10, 0.5), 1023 / 1024)).toBe(true)
    })
  })
})
