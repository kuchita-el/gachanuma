'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-8">
      <Alert variant="destructive">
        <AlertTitle>予期しないエラーが発生しました</AlertTitle>
        <AlertDescription>
          入力を見直して再試行してください。
        </AlertDescription>
      </Alert>
      <Button type="button" onClick={() => reset()} className="mt-4">
        再試行
      </Button>
    </div>
  )
}
