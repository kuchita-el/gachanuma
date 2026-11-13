import * as React from 'react'

import { Button } from '@/components/ui/button'
import { keepFocusOnMouseDown } from '@/lib/keep-focus-on-mouse-down'
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
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="計算結果"
      className={cn('bg-primary/10 rounded-lg p-6', className)}
    >
      <h2 className="mb-2 text-lg font-semibold">計算結果</h2>
      <div
        data-testid="result-panel-body"
        className={cn('transition-opacity', stale && 'opacity-50')}
      >
        {children}
      </div>
      {/* 注記とボタンは薄表示の対象外にし、はっきり見せる。live region 内なので出現時に1回読み上げられる */}
      {stale && (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-sm font-medium">{STALE_RESULT_NOTICE}</p>
          {onRecalculate && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              // 計算ボタンと同じく、押し下げで入力欄の検証が走りボタンがずれて押下が無視されるのを防ぐ
              onMouseDown={keepFocusOnMouseDown}
              onClick={onRecalculate}
            >
              この入力で再計算
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export { ResultPanel }
