import * as React from 'react'

import { Button } from '@/components/ui/button'
import { useKeepFocusOnPress } from '@/lib/use-keep-focus-on-press'
import { cn } from '@/lib/utils'

/** 入力変更後に表示する、結果が古いことの注記（Issue #9） */
export const STALE_RESULT_NOTICE = '入力が変わったため、この結果は変更前の入力のものです。'

type ResultPanelProps = {
  children: React.ReactNode
  className?: string
  /**
   * 表示中の結果が現在の入力と一致しない（計算後に入力が変更された）か。
   * true のとき結果を薄く表示し、注記と「この入力で再計算」ボタンを添える（Issue #9）。
   */
  stale?: boolean
  /** 「この入力で再計算」ボタンの処理。フォームの計算ボタンと同じ処理を渡す */
  onRecalculate?: () => void
}

function ResultPanel({ children, className, stale = false, onRecalculate }: ResultPanelProps) {
  const recalculatePressProps = useKeepFocusOnPress(onRecalculate)
  return (
    <div className={cn('bg-primary/10 rounded-lg p-6', className)}>
      {/* 再計算ボタンを live region に含めると、結果が変わるたびにボタンのラベルまで読み上げられる */}
      <div role="status" aria-live="polite" aria-label="計算結果">
        <h2 className="mb-2 text-lg font-semibold">計算結果</h2>
        <div
          data-testid="result-panel-body"
          className={cn('transition-opacity', stale && 'opacity-50')}
        >
          {children}
        </div>
        {/* 注記は薄くしない。結果が古いことを見落とさせないため */}
        {stale && (
          <p className="mt-4 text-sm font-medium">{STALE_RESULT_NOTICE}</p>
        )}
      </div>
      {stale && onRecalculate && (
        <Button
          type="button"
          variant="outline"
          className="mt-2 min-h-11"
          {...recalculatePressProps}
        >
          この入力で再計算
        </Button>
      )}
    </div>
  )
}

export { ResultPanel }
