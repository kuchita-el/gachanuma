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

export const metadata: Metadata = {
  title: '確率の泥沼',
  description: '成功率をもとに何回の試行でどれだけの成功率になるかを計算するアプリ',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-screen-sm px-4 py-4">
            <h1 className="text-lg font-semibold">確率の泥沼</h1>
          </div>
        </header>
        <main className="mx-auto max-w-screen-sm px-4">{children}</main>
      </body>
    </html>
  )
}
