'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()

  useEffect(() => {
    console.error('[error-boundary]', {
      pathname,
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      cause: error.cause,
    })
  }, [error, pathname])

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-8">
      <Alert variant="destructive">
        <AlertTitle>予期しないエラーが発生しました</AlertTitle>
        <AlertDescription>
          再試行ボタンで再実行できます。問題が続く場合はページを再読み込みしてください。
        </AlertDescription>
      </Alert>
      <Button type="button" onClick={() => reset()} className="mt-4">
        再試行
      </Button>
    </div>
  )
}
