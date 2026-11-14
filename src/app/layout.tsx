import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const TITLE = '確率の泥沼'
/** ページ冒頭のリード文（page.tsx、Issue #18）と OGP 画像の文言（scripts/generate-icons.mjs）と同じ文言にする */
const DESCRIPTION = 'ガチャなどの成功率から、目標の確率で成功するまでに必要な回数や、決まった回数で成功する確率を計算します。'

export const metadata: Metadata = {
  /**
   * OGP 画像などを絶対 URL にするための基準（Issue #24）。デプロイ先は SITE_URL で渡す（deploy.yml）。
   * basePath（/gachanuma）は Next.js が画像のパスに付けるため、ここにはオリジンだけを渡す。
   * パスまで含めると /gachanuma/gachanuma/... と二重になる。
   */
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    locale: 'ja_JP',
    type: 'website',
  },
  // 画像は opengraph-image.png を共用する（twitter-image は置かない）
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {/*
          ダークモードでは --primary が明るい色に反転し、ヘッダーが眩しい帯になるため、暗い面の色にする（Issue #22）
        */}
        <header className="bg-primary text-primary-foreground dark:bg-card dark:text-card-foreground dark:border-b">
          <div className="mx-auto max-w-screen-sm px-4 py-4">
            <h1 className="text-lg font-semibold">確率の泥沼</h1>
          </div>
        </header>
        <main className="mx-auto max-w-screen-sm px-4">{children}</main>
      </body>
    </html>
  )
}
