import { test, expect } from 'claude-code/testing'

import { MAX_CRABS } from './gauge'
import {
  CRAB_W,
  CREW_SCALE,
  CTX_SCALE,
  CTX_W,
  PALETTE,
  PATROL,
  accessoryFor,
  colorFor,
  crab,
  crewAlt,
  moodForStatus,
  shortType,
  crabX,
  crewCount,
  crewSize,
  crewSvg,
  ctxBarSvg,
  moodFor,
} from './draw'

const balanced = (svg: string) =>
  (svg.match(/<g[ >]/g) ?? []).length === (svg.match(/<\/g>/g) ?? []).length &&
  svg.startsWith('<svg') &&
  svg.endsWith('</svg>')

test('context bar svg is well-formed, coloured by level, with the crab and a tick', () => {
  const s = ctxBarSvg(38, 'ok', 45)
  expect(balanced(s)).toBe(true)
  expect(s).toContain('#4caf7d')
  expect(s).toContain('#D97757')
  expect(s).toContain('class="patrol"')
  expect(s).toContain(`width="${Math.round(0.38 * CTX_W)}"`)
  expect(ctxBarSvg(80, 'over')).toContain('#d9534f')
  expect(ctxBarSvg(0, 'ok')).not.toContain('#4caf7d')
})

test('animation stops under prefers-reduced-motion', () => {
  const s = ctxBarSvg(50, 'near', 45)
  expect(s).toContain('@media (prefers-reduced-motion: reduce)')
  expect(s).toContain('.patrol{animation:none')
  expect(s).toContain('@keyframes pt')
  expect(s).toContain('shape-rendering="crispEdges"')
})

test('crab x follows the percent and stays inside the bar while patrolling', () => {
  const w = CRAB_W * CTX_SCALE
  for (const p of [-20, 0, 1, 50, 99, 100, 140]) {
    const x = crabX(p, CTX_W, CTX_SCALE)
    expect(x >= PATROL).toBe(true)
    expect(x + w + PATROL <= CTX_W).toBe(true)
  }
  expect(crabX(30, CTX_W, CTX_SCALE) < crabX(60, CTX_W, CTX_SCALE)).toBe(true)
  expect(crabX(50, CTX_W, CTX_SCALE)).toBe(CTX_W / 2 - w / 2)
})

test('mood follows the context level', () => {
  expect(moodFor('ok')).toBe('up')
  expect(moodFor('near')).toBe('flat')
  expect(moodFor('over')).toBe('down')
  expect(crab(0, 0, 1, 'up')).toContain('class="wave"')
  expect(crab(0, 0, 1, 'down')).toContain('class="drop"')
  expect(crab(0, 0, 1, 'flat')).not.toContain('class="drop"')
})

const member = (type: string, status = 'running') => ({ type, status, description: 'task' })
const crewOf = (n: number, type = 'general-purpose', status = 'running') =>
  Array.from({ length: n }, () => member(type, status))

test('one crab per subagent, capped', () => {
  const count = (s: string) => (s.match(/shape-rendering="crispEdges"/g) ?? []).length
  expect(count(crewSvg(crewOf(3)))).toBe(3)
  expect(count(crewSvg(crewOf(25)))).toBe(MAX_CRABS)
  expect(MAX_CRABS).toBe(10)
  expect(crewCount(-2)).toBe(0)
  expect(crewSvg([])).not.toContain('crispEdges')
  expect(balanced(crewSvg(crewOf(4)))).toBe(true)
  expect(crewSize(crewOf(1)).width).toBe(CRAB_W * CREW_SCALE)
  expect(crewSize(crewOf(25)).width).toBe(crewSize(crewOf(MAX_CRABS)).width)
})

test('colour by agent type, plugin prefix dropped, unknown types hashed stably', () => {
  expect(colorFor('Explore')).toBe('#5B8DEF')
  expect(colorFor('Plan')).toBe('#2FB5A8')
  for (const t of ['general-purpose', 'standard', 'savvy-medium', 'claude']) expect(colorFor(t)).toBe('#D97757')
  expect(colorFor('light')).toBe('#3B9C5F')
  expect(colorFor('savvy-light')).toBe('#3B9C5F')
  expect(colorFor('savvy-careful')).toBe('#E0A030')
  expect(colorFor('deep')).toBe('#9B7BD6')
  expect(colorFor('savvy-heavy')).toBe('#9B7BD6')
  expect(colorFor('savvy-fable')).toBe('#E05DA8')
  expect(colorFor('claude-code-guide')).toBe('#38BDF8')
  expect(colorFor('statusline-setup')).toBe('#8E929A')
  expect(colorFor('savvy-flow:savvy-medium')).toBe('#D97757')
  expect(colorFor('savvy-flow:savvy-fable')).toBe('#E05DA8')
  expect(shortType('savvy-flow:savvy-medium')).toBe('savvy-medium')
  const u = colorFor('my-plugin:weird-agent')
  expect((PALETTE as readonly string[]).includes(u)).toBe(true)
  expect(colorFor('my-plugin:weird-agent')).toBe(u)
  expect(colorFor('other:Weird-Agent')).toBe(u)
})

test('accessory by role', () => {
  expect(accessoryFor('Explore')).toBe('magnifier')
  expect(accessoryFor('light')).toBe('cap')
  expect(accessoryFor('savvy-flow:savvy-light')).toBe('cap')
  expect(accessoryFor('savvy-careful')).toBe('glasses')
  expect(accessoryFor('deep')).toBe('helmet')
  expect(accessoryFor('savvy-flow:savvy-heavy')).toBe('helmet')
  expect(accessoryFor('savvy-flow:savvy-fable')).toBe('crown')
  expect(accessoryFor('Plan')).toBe('clipboard')
  expect(accessoryFor('bm-research')).toBe('magnifier')
  expect(accessoryFor('bm-planner')).toBe('clipboard')
  expect(accessoryFor('bm-coder')).toBe('headphones')
  expect(accessoryFor('bm-mechanic')).toBe('hardhat')
  expect(accessoryFor('bm-light')).toBe('mortarboard')
  expect(accessoryFor('bm-deep')).toBe('miner')
  expect(accessoryFor('general-purpose')).toBe('none')
  expect(accessoryFor('unknown')).toBe('none')
  // every accessory stays inside the 30x28 grid
  for (const a of ['magnifier', 'cap', 'glasses', 'helmet', 'crown', 'clipboard', 'headphones', 'hardhat', 'mortarboard', 'miner'] as const) {
    const s = crab(0, 0, 1, 'up', { accessory: a })
    for (const r of s.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
      expect(Number(r[1]) + Number(r[3]) <= 30).toBe(true)
      expect(Number(r[2]) + Number(r[4]) <= 28).toBe(true)
    }
  }
  expect(crab(0, 0, 1, 'flat', { accessory: 'crown' })).toContain('#F2C230')
  expect(crab(0, 0, 1, 'flat', { accessory: 'helmet' })).toContain('#8E929A')
})

test('mood by status', () => {
  expect(moodForStatus('running')).toBe('flat')
  expect(moodForStatus('waiting')).toBe('sleep')
  expect(moodForStatus('idle')).toBe('sleep')
  expect(moodForStatus('pending')).toBe('sleep')
  expect(moodForStatus('completed')).toBe('up')
  expect(moodForStatus('failed')).toBe('down')
  expect(moodForStatus('killed')).toBe('down')
})

test('sleeping crab: still legs, slow bob, floating z', () => {
  const s = crab(0, 0, 1, 'sleep')
  expect(s).not.toContain('class="la"')
  expect(s).not.toContain('class="lb"')
  expect(s).not.toContain('class="run"')
  expect(s).toContain('class="zf"')
  expect(s).toContain('class="sb"')
  expect(crab(0, 0, 1, 'flat')).toContain('class="la"')
  expect(crab(0, 0, 1, 'flat')).not.toContain('class="zf"')
})

test('reduced motion also stops the sleep bob and the z', () => {
  const s = crewSvg([member('Explore', 'idle')])
  const rm = s.slice(s.indexOf('@media (prefers-reduced-motion: reduce)'))
  expect(s).toContain('@keyframes zf')
  expect(rm).toContain('.zf')
  expect(rm).toContain('.zz .sb')
})

test('one body colour per type present, alt text lists the crew', () => {
  const crew = [member('Explore'), member('savvy-flow:savvy-light', 'idle'), member('general-purpose', 'completed')]
  const s = crewSvg(crew)
  expect(s).toContain('#5B8DEF')
  expect(s).toContain('#3B9C5F')
  expect(s).toContain('#D97757')
  expect(s).not.toContain('#9B7BD6')
  expect(s).not.toContain('#E05DA8')
  expect(balanced(s)).toBe(true)
  expect(crewAlt(crew)).toBe('3 subagents: Explore running, savvy-light idle, general-purpose completed')
  expect(crewAlt([member('Plan')])).toBe('1 subagent: Plan running')
})

test('context crab keeps clay and no accessory', () => {
  const s = ctxBarSvg(50, 'near', 45)
  expect(s).toContain('#D97757')
  expect(s).not.toContain('#F2C230')
  expect(s).not.toContain('class="zf"')
  expect(s).toContain('class="la"')
})

import { meterSize, meterSvg } from './draw'

test('meters share one height so they sit on one line', () => {
  const a = { label: 'ctx', value: '38% 76k', percent: 38, level: 'ok' as const, mark: 45, hasCrab: true }
  const b = { label: '5h', value: '23%', percent: 23, level: 'ok' as const }
  expect(meterSize(a).height).toBe(meterSize(b).height)
  expect(meterSvg(a)).toContain('class="patrol"')
  expect(meterSvg(b)).not.toContain('class="patrol"')
  expect(meterSvg(a)).toContain('>38% 76k<')
})

test('a meter note sits on the same baseline and widens the meter', () => {
  const m = { label: 'div', value: '42%', percent: 42, level: 'ok' as const }
  const withNote = { ...m, note: 'topics 3 · a & b' }
  expect(meterSize(withNote).width > meterSize(m).width).toBe(true)
  expect(meterSize(withNote).height).toBe(meterSize(m).height)
  const src = meterSvg(withNote)
  expect(src).toContain('topics 3 · a &amp; b')
  const ys = [...src.matchAll(/<text [^>]*y="([\d.]+)"/g)].map(x => x[1])
  expect(new Set(ys).size).toBe(1)
})
