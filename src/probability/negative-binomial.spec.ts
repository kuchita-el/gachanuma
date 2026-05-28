import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { calculateTrialCountForMultipleSuccess } from './negative-binomial'
import { calculateTrialCount } from './calculator'
import {
  validConfidenceSchema,
  validProbabilityRatioSchema,
  validTargetCountSchema,
} from './probability'

// 計算層は検証済みブランド値を受領する。spec では生数値を v.parse でブランド化して渡す。
const prob = (r: number) => v.parse(validProbabilityRatioSchema, r)
const conf = (r: number) => v.parse(validConfidenceSchema, r)
const target = (n: number) => v.parse(validTargetCountSchema, n)

describe('calculateTrialCountForMultipleSuccess', () => {
  describe('targetCount=1 で calculateTrialCount と同一値（回帰）', () => {
    const cases: Array<[number, number, number]> = [
      [0.01, 0.9, 230],
      [0.1, 0.9, 22],
      [0.5, 0.9, 4],
      [0.5, 0.99, 7],
      [0.99, 0.9, 1],
    ]
    for (const [p, c, expected] of cases) {
      it(`p=${p}, targetCount=1, c=${c} → ${expected}`, () => {
        expect(calculateTrialCountForMultipleSuccess(prob(p), target(1), conf(c))._unsafeUnwrap()).toBe(expected)
        expect(calculateTrialCountForMultipleSuccess(prob(p), target(1), conf(c))._unsafeUnwrap()).toBe(
          calculateTrialCount(prob(p), conf(c))._unsafeUnwrap(),
        )
      })
    }
  })

  describe('正常系（targetCount >= 2）', () => {
    it('p=0.5, targetCount=2, c=0.9 → 7', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(2), conf(0.9))._unsafeUnwrap()).toBe(7)
    })

    it('p=0.5, targetCount=10, c=0.9 → 26（厳密値）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(10), conf(0.9))._unsafeUnwrap()).toBe(26)
    })

    it('p=0.1, targetCount=5, c=0.9 → 78（厳密値）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.1), target(5), conf(0.9))._unsafeUnwrap()).toBe(78)
    })

    it('p=0.5, targetCount=100, c=0.9 → 218（厳密値、正規近似 k≈218 と整合）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(100), conf(0.9))._unsafeUnwrap()).toBe(218)
    })
  })

  describe('単調性', () => {
    it('targetCount 増加に対し試行回数は単調非減少', () => {
      const ns = [1, 2, 5, 10, 20].map(t =>
        calculateTrialCountForMultipleSuccess(prob(0.5), target(t), conf(0.9))._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })

    it('信頼度増加に対し試行回数は単調非減少', () => {
      const ns = [0.5, 0.8, 0.9, 0.99].map(c =>
        calculateTrialCountForMultipleSuccess(prob(0.5), target(3), conf(c))._unsafeUnwrap(),
      )
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!).toBeGreaterThanOrEqual(ns[i - 1]!)
      }
    })
  })

  describe('浮動小数点境界', () => {
    it('p=1e-17, targetCount=1 は NonFiniteResult（既存 calculateTrialCount 経由）', () => {
      const result = calculateTrialCountForMultipleSuccess(prob(1e-17), target(1), conf(0.9))
      expect(result._unsafeUnwrapErr().kind).toBe('NonFiniteResult')
    })

    it('p=1e-17, targetCount=2 では反復上限超過で IterationLimitExceeded', () => {
      const result = calculateTrialCountForMultipleSuccess(prob(1e-17), target(2), conf(0.9))
      expect(result._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })
  })

  // exact-threshold（P(X≥target|k) = c ちょうど）で数学的に正しい最小 k を返す（AC2）。
  // 二分探索の述語比較に EPS_THRESHOLD=1e-12 を乗せて不完全ベータの sub-ULP undershoot を吸収する経路の回帰。
  // spike で確認された不一致 4 件（p=0.5, c=0.5, target ∈ {2, 5, 10, 25}）を全て回帰として固定。
  describe('exact-threshold（dyadic、p=0.5, c=0.5）', () => {
    it('NB11a: target=2 → k=3（P(X≥2|3,0.5) = 4/8 = 0.5 厳密）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(2), conf(0.5))._unsafeUnwrap()).toBe(3)
    })

    it('NB9a: target=5 → k=9（P(X≥5|9,0.5) = 256/512 = 0.5 厳密）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(5), conf(0.5))._unsafeUnwrap()).toBe(9)
    })

    it('NB11b: target=10 → k=19（Bin(19,0.5) の対称性で P(X≥10) = 0.5 厳密）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(10), conf(0.5))._unsafeUnwrap()).toBe(19)
    })

    it('NB9b: target=25 → k=49（Bin(49,0.5) の対称性で P(X≥25) = 0.5 厳密）', () => {
      expect(calculateTrialCountForMultipleSuccess(prob(0.5), target(25), conf(0.5))._unsafeUnwrap()).toBe(49)
    })
  })

  // NB10: targetCount=1 委譲の追加代表値（既存 NB1 5 件と非重複の p∈{0.001, 0.05, 0.5}）。AC3。
  describe('targetCount=1 委譲拡張（NB1 と非重複代表値）', () => {
    const cases: Array<[number, number]> = [
      [0.001, 0.9],
      [0.001, 0.99],
      [0.05, 0.95],
      [0.5, 0.5],
    ]
    for (const [p, c] of cases) {
      it(`p=${p}, c=${c}: calculateTrialCount と完全同値`, () => {
        const multi = calculateTrialCountForMultipleSuccess(prob(p), target(1), conf(c))._unsafeUnwrap()
        const single = calculateTrialCount(prob(p), conf(c))._unsafeUnwrap()
        expect(multi).toBe(single)
      })
    }
  })

  // NB12/NB13: 極小 p で IterationLimitExceeded を返す回帰（AC4）。
  describe('反復上限超過（追加異常系）', () => {
    it('NB12a: p=1e-17, target=2, c=0.99 → IterationLimitExceeded', () => {
      const r = calculateTrialCountForMultipleSuccess(prob(1e-17), target(2), conf(0.99))
      expect(r._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })

    it('NB12b: p=1e-17, target=100, c=0.9 → IterationLimitExceeded', () => {
      const r = calculateTrialCountForMultipleSuccess(prob(1e-17), target(100), conf(0.9))
      expect(r._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })

    it('NB13: p=1e-15, target=50, c=0.99 → IterationLimitExceeded（極限近傍）', () => {
      const r = calculateTrialCountForMultipleSuccess(prob(1e-15), target(50), conf(0.99))
      expect(r._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })
  })

  // NB16: dynamicLimit 上下バンド検証。上=収束不能で err、下=実用域で ok（AC4）。
  describe('dynamicLimit 上下バンド', () => {
    it('NB16_upper: p=1e-12, target=100, c=0.99 は dynamicLimit を超え IterationLimitExceeded', () => {
      const r = calculateTrialCountForMultipleSuccess(prob(1e-12), target(100), conf(0.99))
      expect(r._unsafeUnwrapErr().kind).toBe('IterationLimitExceeded')
    })

    it('NB16_lower: p=0.001, target=10, c=0.99 は dynamicLimit (=500000) の十分内側で ok を返す', () => {
      const r = calculateTrialCountForMultipleSuccess(prob(0.001), target(10), conf(0.99))
      expect(r.isOk()).toBe(true)
    })
  })

  // NB14/NB15: 性能 budget。AC1「メインスレッドをブロックしない」の定量保証。
  // budget 値の根拠（NB17 注記相当）: 50ms は React 1 frame (16.7ms) の 3 倍。spike 実測の
  // 最悪 0.02ms に対し 2500 倍のマージン。CI jitter を考慮して 16ms ではなく 50ms を採用。
  describe('性能 budget（AC1）', () => {
    it('NB14: 最悪入力 (p=1e-5, target=100, c=0.99) が 50ms 以下で完了', () => {
      // ウォームアップ（JIT/キャッシュの揺らぎを排除）
      calculateTrialCountForMultipleSuccess(prob(1e-5), target(100), conf(0.99))
      const t0 = performance.now()
      const r = calculateTrialCountForMultipleSuccess(prob(1e-5), target(100), conf(0.99))
      const elapsed = performance.now() - t0
      // ok / err は問わず（dynamicLimit 内で収束しなければ IterationLimitExceeded だがそれも許容）
      expect(r.isOk() || r._unsafeUnwrapErr().kind === 'IterationLimitExceeded').toBe(true)
      expect(elapsed).toBeLessThan(50)
    })

    it('NB15: 重い実用入力 (p=0.001, target=10, c=0.99) が 10ms 以下で完了', () => {
      calculateTrialCountForMultipleSuccess(prob(0.001), target(10), conf(0.99))
      const t0 = performance.now()
      const r = calculateTrialCountForMultipleSuccess(prob(0.001), target(10), conf(0.99))
      const elapsed = performance.now() - t0
      expect(r.isOk()).toBe(true)
      expect(elapsed).toBeLessThan(10)
    })
  })

  // NB6: 数値一致グリッド (p × target × c = 4 × 5 × 3 = 60 ケース)。AC2「既存値一致」を網羅的に検証。
  // 期待値は本実装で算出した fixture（spike で旧実装と 100% 一致を確認した p ≤ 0.1 帯のみ採用、
  // exact-threshold dyadic は別 describe で扱う）。
  describe('数値一致グリッド（NB6, p×target×c 60 ケース）', () => {
    type GridCase = [number, number, number, number]
    const grid: GridCase[] = [
      [0.1, 2, 0.9, 38], [0.1, 2, 0.95, 46], [0.1, 2, 0.99, 64],
      [0.1, 5, 0.9, 78], [0.1, 5, 0.95, 89], [0.1, 5, 0.99, 113],
      [0.1, 10, 0.9, 140], [0.1, 10, 0.95, 154], [0.1, 10, 0.99, 183],
      [0.1, 50, 0.9, 588], [0.1, 50, 0.95, 615], [0.1, 50, 0.99, 670],
      [0.1, 100, 0.9, 1123], [0.1, 100, 0.95, 1161], [0.1, 100, 0.99, 1235],
      [0.05, 2, 0.9, 77], [0.05, 2, 0.95, 93], [0.05, 2, 0.99, 130],
      [0.05, 5, 0.9, 158], [0.05, 5, 0.95, 181], [0.05, 5, 0.99, 229],
      [0.05, 10, 0.9, 282], [0.05, 10, 0.95, 311], [0.05, 10, 0.99, 371],
      [0.05, 50, 0.9, 1180], [0.05, 50, 0.95, 1237], [0.05, 50, 0.99, 1349],
      [0.05, 100, 0.9, 2254], [0.05, 100, 0.95, 2331], [0.05, 100, 0.99, 2482],
      [0.01, 2, 0.9, 388], [0.01, 2, 0.95, 473], [0.01, 2, 0.99, 662],
      [0.01, 5, 0.9, 798], [0.01, 5, 0.95, 913], [0.01, 5, 0.99, 1157],
      [0.01, 10, 0.9, 1418], [0.01, 10, 0.95, 1568], [0.01, 10, 0.99, 1874],
      [0.01, 50, 0.9, 5920], [0.01, 50, 0.95, 6211], [0.01, 50, 0.99, 6781],
      [0.01, 100, 0.9, 11295], [0.01, 100, 0.95, 11691], [0.01, 100, 0.99, 12460],
      [0.001, 2, 0.9, 3889], [0.001, 2, 0.95, 4742], [0.001, 2, 0.99, 6636],
      [0.001, 5, 0.9, 7992], [0.001, 5, 0.95, 9151], [0.001, 5, 0.99, 11601],
      [0.001, 10, 0.9, 14204], [0.001, 10, 0.95, 15702], [0.001, 10, 0.99, 18779],
      [0.001, 50, 0.9, 59244], [0.001, 50, 0.95, 62165], [0.001, 50, 0.99, 67894],
      [0.001, 100, 0.9, 113004], [0.001, 100, 0.95, 116989], [0.001, 100, 0.99, 124710],
    ]
    for (const [p, t, c, expected] of grid) {
      it(`p=${p}, target=${t}, c=${c} → ${expected}`, () => {
        expect(calculateTrialCountForMultipleSuccess(prob(p), target(t), conf(c))._unsafeUnwrap()).toBe(expected)
      })
    }
  })
})

describe('validTargetCountSchema', () => {
  it('典型値 1 を渡すとそのまま 1 を返す', () => {
    expect(v.parse(validTargetCountSchema, 1)).toBe(1)
  })

  it('境界値 100 を渡すとそのまま 100 を返す', () => {
    expect(v.parse(validTargetCountSchema, 100)).toBe(100)
  })

  it('0 を渡すと ValiError、メッセージに「目標成功回数」を含む', () => {
    expect(() => v.parse(validTargetCountSchema, 0)).toThrow(/目標成功回数/)
  })

  it('101 を渡すと ValiError、メッセージに「100以下」を含む', () => {
    expect(() => v.parse(validTargetCountSchema, 101)).toThrow(/100以下/)
  })

  it('1.5（小数）を渡すと ValiError、メッセージに「整数」を含む', () => {
    expect(() => v.parse(validTargetCountSchema, 1.5)).toThrow(/整数/)
  })

  it('文字列を渡すと ValiError', () => {
    expect(() => v.parse(validTargetCountSchema, '5')).toThrow()
  })

  it('NaN を渡すと ValiError', () => {
    expect(() => v.parse(validTargetCountSchema, NaN)).toThrow()
  })

  it('Infinity を渡すと ValiError（整数チェックで弾かれる）', () => {
    expect(() => v.parse(validTargetCountSchema, Infinity)).toThrow()
  })
})
