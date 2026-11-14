/**
 * アイコンと OGP 画像を生成し、src/app/ に書き出す（Issue #24）。
 *
 * 生成物（icon.svg / apple-icon.png / favicon.ico / opengraph-image.png）はコミットする。
 * ビルド時に生成しないのは、OGP 画像の日本語が実行環境のフォントで崩れないよう、
 * 確認済みの PNG を配るため。opengraph-image.tsx（ImageResponse）は日本語フォントの埋め込みが要るため採らない。
 *
 * 実行: node scripts/generate-icons.mjs
 * Playwright の Chromium が既定の場所にない環境では、CHROMIUM_EXECUTABLE でパスを指定する。
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const OUT_DIR = fileURLToPath(new URL('../src/app/', import.meta.url))

/** ヘッダーと同じ暗い背景（--primary: oklch(0.205 0 0)） */
const BACKGROUND = '#171717'
/** グラフの主曲線（ダーク背景用の --chart-1） */
const CURVE = '#59a0f9'
/** グラフのマーカー（ダーク背景用の --chart-2） */
const MARKER = '#f59145'

const TITLE = '確率の泥沼'
const DESCRIPTION = 'ガチャなどの成功率から、目標の確率で成功するまでに必要な回数や、決まった回数で成功する確率を計算します。'

/**
 * 累積成功確率 1 − e^(−x) の曲線を、指定の矩形に収まる SVG パスにする。
 * 90% 到達点（マーカーを置く位置）の座標も返す。
 */
function curvePath({ left, top, width, height }) {
  const xMax = 4
  const toPoint = (x) => {
    const y = 1 - Math.exp(-x)
    return [left + (x / xMax) * width, top + (1 - y) * height]
  }
  const points = Array.from({ length: 41 }, (_, i) => toPoint((i / 40) * xMax))
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
  return { d, marker: toPoint(Math.log(10)) }
}

/** アイコンの SVG。rounded が false なら角丸なし（iOS が自分で角を丸めるため） */
function iconSvg({ rounded }) {
  const { d, marker } = curvePath({ left: 7, top: 7, width: 18, height: 18 })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="${BACKGROUND}"/>
  <path d="${d}" fill="none" stroke="${CURVE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${marker[0].toFixed(2)}" cy="${marker[1].toFixed(2)}" r="3" fill="${MARKER}" stroke="${BACKGROUND}" stroke-width="1"/>
</svg>
`
}

function ogpHtml() {
  const { d, marker } = curvePath({ left: 720, top: 150, width: 400, height: 330 })
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; background: ${BACKGROUND}; color: #fafafa;
    font-family: "Hiragino Sans", "Noto Sans JP", "IPAPGothic", sans-serif; position: relative; overflow: hidden; }
  svg { position: absolute; inset: 0; }
  .text { position: absolute; left: 80px; top: 150px; width: 560px; }
  h1 { margin: 0; font-size: 96px; font-weight: 700; letter-spacing: 0.04em; }
  p { margin: 40px 0 0; font-size: 30px; line-height: 1.6; color: #d4d4d4; }
</style></head><body>
  <svg width="1200" height="630" viewBox="0 0 1200 630">
    <path d="M720 480 H1120 M720 150 V480" stroke="#404040" stroke-width="3"/>
    <path d="${d}" fill="none" stroke="${CURVE}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${marker[0]}" cy="${marker[1]}" r="16" fill="${MARKER}" stroke="${BACKGROUND}" stroke-width="5"/>
  </svg>
  <div class="text"><h1>${TITLE}</h1><p>${DESCRIPTION}</p></div>
</body></html>`
}

/** PNG 画像をそのまま格納した ICO ファイルを作る（Windows Vista 以降・主要ブラウザが対応） */
function pngsToIco(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i
    // 幅・高さの 0 は 256px を表す
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(data.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...pngs.map(p => p.data)])
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE })
try {
  const renderSvg = async (svg, size) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    )
    const data = await page.screenshot({ omitBackground: true })
    await page.close()
    return data
  }

  const icon = iconSvg({ rounded: true })
  await writeFile(`${OUT_DIR}icon.svg`, icon)
  await writeFile(`${OUT_DIR}apple-icon.png`, await renderSvg(iconSvg({ rounded: false }), 180))
  const icoPngs = await Promise.all([16, 32, 48].map(async size => ({ size, data: await renderSvg(icon, size) })))
  await writeFile(`${OUT_DIR}favicon.ico`, pngsToIco(icoPngs))

  const ogp = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await ogp.setContent(ogpHtml())
  await writeFile(`${OUT_DIR}opengraph-image.png`, await ogp.screenshot())
  await ogp.close()
}
finally {
  await browser.close()
}
