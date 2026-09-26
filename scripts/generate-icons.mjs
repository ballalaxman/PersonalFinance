// Generates the favicon, PWA icons and notification badge in public/.
// Run with `npm run icons` after changing the artwork below.
import { writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const BRAND = '#6558D3' // theme_color in vite.config.ts
// Lucide "piggy-bank" (ISC), the same mark used in the app's sidebar logo.
const PIGGY = [
  'M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z',
  'M2 9v1c0 1.1.9 2 2 2h1',
  'M16 11h.01',
]

/** The mark centred in a 24×24 box, occupying `scale` of it. */
function mark(scale, stroke, color = '#fff') {
  const offset = (24 - 24 * scale) / 2
  // The piggy's bounding box is centred at y=12.5 in its grid, so lift it half a unit
  return `<g transform="translate(${offset} ${offset - 0.5 * scale}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${PIGGY.map((d) => `<path d="${d}"/>`).join('')}</g>`
}

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`

const icons = {
  // Rounded tile for browsers and the "any" manifest icon
  standard: svg(`<rect width="24" height="24" rx="5.5" fill="${BRAND}"/>${mark(0.62, 2.1)}`),
  // Full-bleed with the mark inside the 80% maskable safe zone (Android crops it)
  maskable: svg(`<rect width="24" height="24" fill="${BRAND}"/>${mark(0.5, 2.1)}`),
  // iOS rounds the corners itself, so no transparent edges
  apple: svg(`<rect width="24" height="24" fill="${BRAND}"/>${mark(0.6, 2.1)}`),
  // Android status-bar badge: only the alpha channel is used
  badge: svg(mark(0.82, 2.2)),
}

function png(name, source, size) {
  const data = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(`public/${name}`, data)
  console.log(`public/${name} (${size}×${size}, ${data.length} bytes)`)
}

writeFileSync('public/favicon.svg', icons.standard + '\n')
console.log('public/favicon.svg')
png('favicon-32x32.png', icons.standard, 32)
png('pwa-192x192.png', icons.standard, 192)
png('pwa-512x512.png', icons.standard, 512)
png('pwa-maskable-512x512.png', icons.maskable, 512)
png('apple-touch-icon.png', icons.apple, 180)
png('badge-96x96.png', icons.badge, 96)
