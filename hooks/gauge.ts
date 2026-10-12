export const MIN_GAUGE_PERCENT = 10
export const MAX_GAUGE_PERCENT = 95
export const GAUGE_WIDTH = 20
export const MAX_CRABS = 10

export function clampGauge(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_GAUGE_PERCENT, Math.max(MIN_GAUGE_PERCENT, Math.round(n)))
}

/** A bar of `width` cells filled to `percent`, with `|` on the cell where `warn` falls. */
export function gaugeBar(percent: number, warn: number, width = GAUGE_WIDTH): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  const mark = Math.min(width - 1, Math.floor((warn / 100) * width))
  let out = ''
  for (let i = 0; i < width; i += 1) {
    if (i === mark) out += '|'
    else out += i < filled ? '█' : '░'
  }
  return out
}

export type Level = 'ok' | 'near' | 'over'

/** `near` from 80% of the threshold, `over` at or past it. */
export function gaugeLevel(percent: number, warn: number): Level {
  if (percent >= warn) return 'over'
  return percent >= warn * 0.8 ? 'near' : 'ok'
}

export function crabs(count: number): string {
  if (count <= 0) return ''
  const shown = '🦀'.repeat(Math.min(count, MAX_CRABS))
  return count > MAX_CRABS ? `${shown} +${count - MAX_CRABS}` : shown
}

export function kTokens(tokens: number | undefined): string {
  return tokens === undefined ? '?' : `${Math.round(tokens / 1000)}k`
}

export const LEVEL_HEX = { ok: '#4caf7d', near: '#e0a93b', over: '#d9534f' } as const

/** A rounded bar as SVG markup, filled to `percent`; `mark` draws a tick at that percent. */
export function barSvg(percent: number, level: Level, width = 120, mark?: number): string {
  const h = 8
  const p = Math.min(100, Math.max(0, percent))
  const fill = Math.max(p > 0 ? h : 0, Math.round((p / 100) * width))
  const tick =
    mark === undefined
      ? ''
      : `<rect x="${Math.round((mark / 100) * width) - 1}" y="0" width="2" height="${h}" fill="#888"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">` +
    `<rect width="${width}" height="${h}" rx="4" fill="#888" fill-opacity="0.3"/>` +
    (fill > 0 ? `<rect width="${fill}" height="${h}" rx="4" fill="${LEVEL_HEX[level]}"/>` : '') +
    tick +
    `</svg>`
  )
}
