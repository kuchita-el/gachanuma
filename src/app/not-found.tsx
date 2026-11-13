import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'ページが見つかりません | 確率の泥沼',
}

// トップへのリンクに <a> ではなく next/link を使うのは、GitHub Pages の basePath（/gachanuma）を付けるため
export default function NotFound() {
  return (
    <div className="mt-16">
      <h2 className="text-xl font-semibold">ページが見つかりません</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Button asChild className="mt-4">
        <Link href="/">トップページへ戻る</Link>
      </Button>
    </div>
  )
}
