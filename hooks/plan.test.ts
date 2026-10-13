import { test, expect } from 'claude-code/testing'

import { applyDone, currentStep, isFinished, parsePlan, planLine } from './plan'
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

test('planBarSvg draws one segment per step across the width', () => {
  const svg = planBarSvg([{ done: true }, { done: false }, { done: false }], 300)
  expect((svg.match(/<rect/g) ?? []).length).toBe(3)
  expect(svg).toContain('width="300"')
  expect(svg).toContain('class="tw"')
})
