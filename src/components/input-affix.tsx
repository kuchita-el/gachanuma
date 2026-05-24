import * as React from 'react'

import { cn } from '@/lib/utils'

type InputAffixProps = {
  suffix: string
  children: React.ReactNode
  className?: string
}

function InputAffix({ suffix, children, className }: InputAffixProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
        {suffix}
      </span>
    </div>
  )
}

export { InputAffix }
