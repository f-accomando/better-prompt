import type { CrewMember } from '../types'
import { LEVEL_HEX, MAX_CRABS, type Level } from './gauge'

// Pure SVG builders for the desktop band: the context bar with the crab on it, and the subagent crabs.
// The crab sprite and its animation follow crab-ledger's draw.ts.
export const CLAY = '#D97757'
const INK = '#1F1E1D'

export type Mood = 'up' | 'down' | 'flat'
/** A crab's face and pose: the context moods plus 'sleep' (closed eyes, slow bob, floating z, still legs). */
export type CrabMood = Mood | 'sleep'
export type Accessory =
  | 'magnifier'
  | 'cap'
  | 'glasses'
  | 'helmet'
  | 'crown'
  | 'clipboard'
  | 'headphones'
  | 'hardhat'
  | 'mortarboard'
  | 'miner'
  | 'none'
export type CrabOptions = { color?: string; accessory?: Accessory }

export const BLUE = '#5B8DEF'
export const TEAL = '#2FB5A8'
export const GREEN = '#3B9C5F'
export const AMBER = '#E0A030'
export const PURPLE = '#9B7BD6'
export const PINK = '#E05DA8'
export const SKY = '#38BDF8'
export const GREY = '#8E929A'
/** Every body colour; an agent type with no colour of its own gets a stable pick from this list. */
export const PALETTE = [BLUE, TEAL, CLAY, GREEN, AMBER, PURPLE, PINK, SKY, GREY] as const

const TYPE_COLOR: Record<string, string> = {
  explore: BLUE,
  plan: TEAL,
  'general-purpose': CLAY,
  standard: CLAY,
  'savvy-medium': CLAY,
  claude: CLAY,
  light: GREEN,
  'savvy-light': GREEN,
  'savvy-careful': AMBER,
  deep: PURPLE,
  'savvy-heavy': PURPLE,
  'savvy-fable': PINK,
  'claude-code-guide': SKY,
  'statusline-setup': GREY,
  'bm-research': BLUE,
  'bm-planner': TEAL,
  'bm-coder': PINK,
  'bm-mechanic': AMBER,
  'bm-light': GREEN,
  'bm-deep': PURPLE,
}

const TYPE_ACCESSORY: Record<string, Accessory> = {
  explore: 'magnifier',
  light: 'cap',
  'savvy-light': 'cap',
  'savvy-careful': 'glasses',
  deep: 'helmet',
  'savvy-heavy': 'helmet',
  'savvy-fable': 'crown',
  plan: 'clipboard',
  // the bm repo's agents: research = magnifier, planner = clipboard, the others have their own prop
  'bm-research': 'magnifier',
  'bm-planner': 'clipboard',
  'bm-coder': 'headphones',
  'bm-mechanic': 'hardhat',
  'bm-light': 'mortarboard',
  'bm-deep': 'miner',
}

/** The agent type without its plugin prefix: `savvy-flow:savvy-medium` -> `savvy-medium`. */
export function shortType(type: string): string {
  const i = type.lastIndexOf(':')
  return i < 0 ? type : type.slice(i + 1)
}

const typeKey = (type: string) => shortType(type).trim().toLowerCase()

/** Body colour of an agent type; unknown types hash to a fixed palette entry. */
export function colorFor(type: string): string {
  const k = typeKey(type)
  const known = TYPE_COLOR[k]
  if (known !== undefined) return known
  let h = 0
  for (let i = 0; i < k.length; i += 1) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** What the crab wears or holds for its role. */
export function accessoryFor(type: string): Accessory {
  return TYPE_ACCESSORY[typeKey(type)] ?? 'none'
}

/** running -> awake and neutral; waiting/idle/pending -> asleep; completed -> happy; failed/killed -> worried. */
export function moodForStatus(status: string): CrabMood {
  switch (status) {
    case 'waiting':
    case 'idle':
    case 'pending':
      return 'sleep'
    case 'completed':
      return 'up'
    case 'failed':
    case 'killed':
      return 'down'
    default:
      return 'flat'
  }
}

/** Sprite grid: 30 wide, feet end at row 26. */
export const CRAB_W = 30
export const CRAB_FEET = 26
/** How far the crab walks to each side of its spot on the bar. */
export const PATROL = 3

export const CTX_W = 160
export const CTX_SCALE = 0.6
export const CTX_BAR_H = 8
export const CTX_BAR_Y = Math.ceil(CRAB_FEET * CTX_SCALE)
export const CTX_H = CTX_BAR_Y + CTX_BAR_H

export const CREW_SCALE = 0.5
const CREW_GAP = 2

const CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob 1s steps(1) infinite}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.wave{transform-origin:0% 100%;animation:wv .6s ease-in-out infinite}@keyframes wv{50%{transform:rotate(-28deg)}}
.tw{animation:bl 1s steps(1) infinite}.tw2{animation:bl 1s steps(1) infinite -.5s}@keyframes bl{50%{opacity:.1}}
.drop{animation:dr 1.6s ease-in infinite}@keyframes dr{0%{transform:translateY(0);opacity:1}80%{transform:translateY(7px);opacity:.2}100%{transform:translateY(7px);opacity:0}}
.patrol{animation:pt 4s ease-in-out infinite alternate}@keyframes pt{0%{transform:translateX(-${PATROL}px)}100%{transform:translateX(${PATROL}px)}}
.zz g{transform-box:fill-box}.zz .sb{animation:sb 2.4s ease-in-out infinite}@keyframes sb{50%{transform:translateY(1px)}}
.zf{animation:zf 2.4s ease-out infinite}@keyframes zf{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-4px);opacity:0}}
.t{fill:#1f1f1f}.s{fill:#6b6b68}.a{fill:#a15c00}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.a{fill:#e8b04a}}
@media (prefers-reduced-motion: reduce){.run .la,.run .lb,.run .bd,.wave,.tw,.tw2,.drop,.zz .sb,.zf,.patrol{animation:none!important}}
</style>`

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const svg = (W: number, H: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${CSS}${body}</svg>`

/** ok -> happy, near -> neutral, over -> worried with a sweat drop. */
export function moodFor(level: Level): Mood {
  return level === 'ok' ? 'up' : level === 'over' ? 'down' : 'flat'
}

const px = (cx: number, cy: number, w: number, h: number, c: string) =>
  `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`

/** Pixel props drawn over the sprite, all inside the 30x28 grid (body x7-22 y10-21, eyes at x9/x19 y12). */
function accessorySvg(a: Accessory): string {
  switch (a) {
    case 'magnifier': // lens above the left claw, handle down into it
      return (
        px(1, 9, 3, 3, '#CDE8FF') +
        px(1, 8, 3, 1, '#5A606B') + px(0, 9, 1, 3, '#5A606B') + px(4, 9, 1, 3, '#5A606B') + px(1, 12, 3, 1, '#5A606B') +
        px(4, 13, 1, 1, '#6B4F2A') + px(5, 14, 1, 1, '#6B4F2A')
      )
    case 'cap': // crown of the cap on top, brim to the right
      return px(10, 7, 10, 3, '#C8453C') + px(13, 6, 4, 1, '#C8453C') + px(19, 9, 5, 1, '#9E332C')
    case 'glasses': // square frames round both eyes and a bridge
      return [8, 18]
        .map(gx => px(gx, 11, 4, 1, INK) + px(gx, 14, 4, 1, INK) + px(gx, 12, 1, 2, INK) + px(gx + 3, 12, 1, 2, INK))
        .join('') + px(12, 12, 6, 1, INK)
    case 'helmet': // grey dome with a darker rim
      return px(10, 6, 10, 1, '#A3A7AE') + px(8, 7, 14, 2, '#8E929A') + px(7, 9, 16, 1, '#6B6F76')
    case 'crown': // gold band, three points, a red jewel
      return (
        px(10, 8, 10, 2, '#F2C230') + px(10, 6, 2, 2, '#F2C230') + px(14, 5, 2, 3, '#F2C230') + px(18, 6, 2, 2, '#F2C230') +
        px(14, 8, 2, 1, '#D33A3A')
      )
    case 'clipboard': // board held above the left claw, clip on top, two lines
      return (
        px(0, 8, 5, 6, '#B07A3A') + px(1, 9, 3, 4, '#F4F1EA') + px(1, 7, 3, 1, '#6B6F76') +
        px(1, 10, 3, 1, '#8E929A') + px(1, 12, 3, 1, '#8E929A')
      )
    case 'headphones': // band over the head, an ear cup each side
      return px(8, 8, 14, 1, '#3A3A3C') + px(7, 8, 1, 7, '#3A3A3C') + px(22, 8, 1, 7, '#3A3A3C') + px(5, 11, 3, 5, '#C2569B') + px(22, 11, 3, 5, '#C2569B')
    case 'hardhat': // yellow dome, a lighter ridge, a darker brim
      return px(10, 6, 10, 1, '#F5C542') + px(8, 7, 14, 2, '#F5C542') + px(14, 6, 2, 3, '#FBE08A') + px(7, 9, 16, 1, '#C99A1E')
    case 'mortarboard': // flat black board, a cap under it, a gold tassel
      return px(6, 5, 18, 2, '#2B2B2B') + px(10, 7, 10, 2, '#2B2B2B') + px(23, 6, 1, 5, '#F5C542') + px(22, 10, 3, 2, '#F5C542')
    case 'miner': // helmet with a lamp on the front
      return px(10, 6, 10, 1, '#B5683A') + px(8, 7, 14, 2, '#A0522D') + px(7, 9, 16, 1, '#6B3A1E') + px(13, 4, 4, 3, '#FFE066') + px(14, 3, 2, 1, '#FFF3B0')
    default:
      return ''
  }
}

/**
 * A pixel crab on a 30x28 grid; the face and the props follow the mood. Awake moods walk in place;
 * 'sleep' closes the eyes, bobs slowly, keeps the legs still and floats a fading z.
 * Options: body colour (clay by default) and an accessory (none by default).
 */
export function crab(x: number, y: number, scale: number, mood: CrabMood, opts: CrabOptions = {}): string {
  const color = opts.color ?? CLAY
  const sleep = mood === 'sleep'
  const face =
    mood === 'up'
      ? px(12, 17, 1, 1, INK) + px(13, 18, 4, 1, INK) + px(17, 17, 1, 1, INK)
      : mood === 'down'
        ? px(12, 19, 1, 1, INK) + px(13, 18, 4, 1, INK) + px(17, 19, 1, 1, INK)
        : px(13, 18, 4, 1, INK)
  const eyes = sleep
    ? px(9, 13, 2, 1, INK) + px(19, 13, 2, 1, INK)
    : px(9, 12, 2, 2, INK) + px(19, 12, 2, 2, INK)
  const arm =
    mood === 'up'
      ? `<g class="wave">${px(23, 8, 4, 4, color)}${px(23, 12, 4, 2, color)}</g>`
      : px(23, 14, 4, 4, color)
  const extra =
    mood === 'up'
      ? `<g class="tw">${px(3, 4, 1, 3, '#F5C542')}${px(2, 5, 3, 1, '#F5C542')}</g><g class="tw2">${px(27, 2, 1, 3, '#F5C542')}${px(26, 3, 3, 1, '#F5C542')}</g>`
      : mood === 'down'
        ? `<g class="drop">${px(24, 5, 2, 3, '#7FB8E8')}${px(25, 4, 1, 1, '#7FB8E8')}</g>`
        : ''
  const body = `${px(7, 10, 16, 12, color)}${px(3, 14, 4, 4, color)}${arm}${eyes}${face}${accessorySvg(opts.accessory ?? 'none')}${extra}`
  const legs = (cls: string, xs: number[]) =>
    `<g${cls === '' ? '' : ` class="${cls}"`}>${xs.map(lx => px(lx, 22, 2, 4, color)).join('')}</g>`
  const inner = sleep
    ? `<g class="zz"><g class="sb">${body}</g>${legs('', [7, 11, 17, 21])}<g class="zf">${px(24, 4, 3, 1, '#9AA4B2')}${px(25, 5, 1, 1, '#9AA4B2')}${px(24, 6, 3, 1, '#9AA4B2')}</g></g>`
    : `<g class="run"><g class="bd">${body}</g>${legs('la', [7, 17])}${legs('lb', [11, 21])}</g>`
  return `<g transform="translate(${x},${y}) scale(${scale})" shape-rendering="crispEdges">${inner}</g>`
}

/** Left edge of the crab centred on the fill end, kept inside the bar even while it patrols. */
export function crabX(percent: number, width: number, scale: number): number {
  const p = Math.min(100, Math.max(0, percent))
  const w = CRAB_W * scale
  const x = (p / 100) * width - w / 2
  return Math.round(Math.min(width - w - PATROL, Math.max(PATROL, x)) * 10) / 10
}

/** Track, coloured fill and threshold tick, and optionally the crab standing on the fill end. */
function barBody(percent: number, level: Level, mark: number | undefined, width: number, hasCrab: boolean): string {
  const p = Math.min(100, Math.max(0, percent))
  const h = CTX_BAR_H
  const y = CTX_BAR_Y
  const fill = Math.max(p > 0 ? h : 0, Math.round((p / 100) * width))
  const tick =
    mark === undefined
      ? ''
      : `<rect x="${Math.round((mark / 100) * width) - 1}" y="${y}" width="2" height="${h}" fill="#888"/>`
  const cy = Math.round((y - CRAB_FEET * CTX_SCALE) * 10) / 10
  return (
    `<rect y="${y}" width="${width}" height="${h}" rx="4" fill="#888" fill-opacity="0.3"/>` +
    (fill > 0 ? `<rect y="${y}" width="${fill}" height="${h}" rx="4" fill="${LEVEL_HEX[level]}"/>` : '') +
    tick +
    (hasCrab ? `<g class="patrol">${crab(crabX(p, width, CTX_SCALE), cy, CTX_SCALE, moodFor(level))}</g>` : '')
  )
}

/** The context bar: track, coloured fill, threshold tick, and the crab standing on the fill end. */
export function ctxBarSvg(percent: number, level: Level, mark?: number, width = CTX_W): string {
  return svg(width, CTX_H, barBody(percent, level, mark, width, true))
}

export const METER_LABEL_W = 26
export const METER_BAR_W = 140
const METER_VALUE_GAP = 8
const NOTE_GAP = 14
const xmlText = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)

export type Meter = {
  label: string
  value: string
  percent: number
  level: Level
  mark?: number
  hasCrab?: boolean
  /** Dim text after the value, drawn on the same baseline (e.g. the topic names). */
  note?: string
}

export function meterSize(m: Meter): { width: number; height: number } {
  const valueW = Math.ceil(m.value.length * 6.6) + 2
  const noteW = m.note ? NOTE_GAP + Math.ceil(m.note.length * 6.2) : 0
  return { width: METER_LABEL_W + METER_BAR_W + METER_VALUE_GAP + valueW + noteW, height: CTX_H }
}

/** One band item: label, bar (crab optional) and value in a single SVG, so every meter shares one baseline. */
export function meterSvg(m: Meter): string {
  const { width, height } = meterSize(m)
  const base = CTX_BAR_Y + CTX_BAR_H - 0.5
  return svg(
    width,
    height,
    `<text class="s" x="0" y="${base}" font-size="11">${m.label}</text>` +
      `<g transform="translate(${METER_LABEL_W},0)">${barBody(m.percent, m.level, m.mark, METER_BAR_W, m.hasCrab === true)}</g>` +
      `<text class="t" x="${METER_LABEL_W + METER_BAR_W + METER_VALUE_GAP}" y="${base}" font-size="11" font-weight="600">${m.value}</text>` +
      (m.note
        ? `<text class="s" x="${METER_LABEL_W + METER_BAR_W + METER_VALUE_GAP + Math.ceil(m.value.length * 6.6) + 2 + NOTE_GAP}" y="${base}" font-size="11">${xmlText(m.note)}</text>`
        : ''),
  )
}

const DONE_COLORS = [GREEN, TEAL, BLUE, SKY, PURPLE, PINK] as const
const PLAN_GAP = 3

/**
 * The task bar, in an SVG as tall as a meter: `label` (done/total) in the label column, then one segment per step
 * from where the other bars start to `width`. Done steps each take their own colour, the step in progress is amber,
 * the rest are grey.
 */
export function planBarSvg(steps: readonly { done: boolean }[], label: string, width: number): string {
  const n = steps.length
  const barW = width - METER_LABEL_W
  const w = (barW - PLAN_GAP * (n - 1)) / n
  const cur = steps.findIndex(s => !s.done)
  const base = CTX_BAR_Y + CTX_BAR_H - 0.5
  const segs = steps
    .map((s, i) => {
      const x = Math.round((METER_LABEL_W + i * (w + PLAN_GAP)) * 10) / 10
      const fill = s.done ? DONE_COLORS[i % DONE_COLORS.length] : i === cur ? AMBER : '#888'
      const opacity = s.done || i === cur ? '' : ' fill-opacity="0.3"'
      return `<rect x="${x}" y="${CTX_BAR_Y}" width="${Math.round(w * 10) / 10}" height="${CTX_BAR_H}" rx="4" fill="${fill}"${opacity}/>`
    })
    .join('')
  return svg(width, CTX_H, `<text class="s" x="0" y="${base}" font-size="11">${xmlText(label)}</text>${segs}`)
}

const ADVICE_H = 14

export function adviceSize(text: string): { width: number; height: number } {
  return { width: Math.ceil(text.length * 6.2) + 2, height: ADVICE_H }
}

/** A suggestion line at the same 11px size as the meter notes, amber or dim. */
export function adviceSvg(text: string, tone: 'amber' | 'dim'): string {
  const { width, height } = adviceSize(text)
  return svg(width, height, `<text class="${tone === 'amber' ? 'a' : 's'}" x="0" y="11" font-size="11">${xmlText(text)}</text>`)
}

/** How many crabs the subagent strip draws. */
export function crewCount(count: number): number {
  return Math.min(Math.max(Math.floor(count), 0), MAX_CRABS)
}

export function crewSize(crew: readonly CrewMember[]): { width: number; height: number } {
  const n = crewCount(crew.length)
  const step = CRAB_W * CREW_SCALE + CREW_GAP
  return { width: Math.max(0, Math.ceil(n * step - CREW_GAP)), height: Math.ceil(28 * CREW_SCALE) }
}

/** One crab per subagent, side by side, capped at MAX_CRABS: colour by type, accessory by role, mood by status. */
export function crewSvg(crew: readonly CrewMember[]): string {
  const n = crewCount(crew.length)
  const { width, height } = crewSize(crew)
  const step = CRAB_W * CREW_SCALE + CREW_GAP
  let body = ''
  for (let i = 0; i < n; i += 1) {
    const m = crew[i]
    body += crab(i * step, 0, CREW_SCALE, moodForStatus(m.status), {
      color: colorFor(m.type),
      accessory: accessoryFor(m.type),
    })
  }
  return svg(width, height, body)
}

/** Alt text for the strip: `3 subagents: Explore running, savvy-light idle, general-purpose completed`. */
export function crewAlt(crew: readonly CrewMember[]): string {
  const n = crew.length
  const list = crew.map(m => `${shortType(m.type)} ${m.status}`).join(', ')
  return `${n} subagent${n === 1 ? '' : 's'}${n === 0 ? '' : `: ${list}`}`
}
