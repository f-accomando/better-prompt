import { test, expect } from 'claude-code/testing'

import { applyDone, currentStep, isFinished, parsePlan, planLine, planValue } from './plan'
import { planBarSvg } from './draw'

const raw = '{"title":"Add login","steps":["write form","hook api","add tests"]}'

test('parsePlan keeps 2 to 6 steps and rejects fewer', () => {
  expect(parsePlan(raw)?.steps).toHaveLength(3)
  expect(parsePlan('{"title":"x","steps":["one"]}')).toBeNull()
  expect(parsePlan('{"title":"","steps":[]}')).toBeNull()
  expect(parsePlan('no json')).toBeNull()
})

test('applyDone ticks the listed steps and keeps earlier ones', () => {
  const p = parsePlan(raw)!
  const a = applyDone(p, '{"done":[1]}')
  expect(a.steps.map(s => s.done)).toEqual([true, false, false])
  const b = applyDone(a, '{"done":[3]}')
  expect(b.steps.map(s => s.done)).toEqual([true, false, true])
  expect(currentStep(b)).toBe(1)
  expect(isFinished(applyDone(b, '{"done":[2]}'))).toBe(true)
})

test('planLine shows count and the current step', () => {
  const a = applyDone(parsePlan(raw)!, '{"done":[1]}')
  expect(planLine(a)).toBe('Add login 1/3 · hook api')
})

test('planValue is done over total as a percentage', () => {
  const a = applyDone(parsePlan(raw)!, '{"done":[1]}')
  expect(planValue(a)).toBe('33%')
  expect(planValue(applyDone(a, '{"done":[2,3]}'))).toBe('100%')
})

test('planBarSvg packs done steps from the left, each in its own colour, with an amber stub while open', () => {
  const svg = planBarSvg([{ done: true }, { done: true }, { done: false }], '2/3', 300, '67%')
  expect(svg).toContain('clip-path')
  expect(svg).toContain('>2/3<')
  expect(svg).toContain('>67%<')
  expect((svg.match(/<rect[^>]*fill="#[0-9A-Fa-f]{6}"\/>/g) ?? []).length).toBe(3)
  expect(svg).not.toContain('class="tw"')
})

test('planBarSvg packs done steps left even when an earlier step is open', () => {
  const svg = planBarSvg([{ done: false }, { done: true }, { done: false }], '1/3', 300, '33%')
  expect(svg).toContain('<rect x="26"')
})
