import * as React from 'react'

import { cn } from '@/lib/utils'

type ResultPanelProps = {
  children: React.ReactNode
  className?: string
}

function ResultPanel({ children, className }: ResultPanelProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="計算結果"
      className={cn('bg-primary/10 rounded-lg p-6', className)}
    >
      <h2 className="mb-2 text-lg font-semibold">計算結果</h2>
      {children}
    </div>
  )
}

export { ResultPanel }
