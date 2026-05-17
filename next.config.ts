import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/gachanuma',
  images: {
    unoptimized: true,
  },
}

export default nextConfig
