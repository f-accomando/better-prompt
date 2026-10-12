import { test, expect } from 'claude-code/testing'

import { clampGauge, crabs, gaugeBar, gaugeLevel, kTokens } from './gauge'

test('clamps the threshold to 10..95 and falls back on junk', () => {
  expect(clampGauge(5, 45)).toBe(10)
  expect(clampGauge(120, 45)).toBe(95)
  expect(clampGauge('abc', 45)).toBe(45)
  expect(clampGauge(33.4, 45)).toBe(33)
})

test('bar fills to the percentage and marks the threshold', () => {
  const bar = gaugeBar(50, 80)
  expect(bar).toHaveLength(20)
  expect(bar.indexOf('|')).toBe(16)
  expect(gaugeBar(0, 50).replace('|', '')).toBe('░'.repeat(19))
  expect(gaugeBar(100, 50).replace('|', '')).toBe('█'.repeat(19))
})

test('levels turn near at 80% of the threshold and over at it', () => {
  expect(gaugeLevel(30, 50)).toBe('ok')
  expect(gaugeLevel(40, 50)).toBe('near')
  expect(gaugeLevel(50, 50)).toBe('over')
})

test('one crab per subagent, capped with a count', () => {
  expect(crabs(0)).toBe('')
  expect(crabs(3)).toBe('🦀🦀🦀')
  expect(crabs(12)).toBe('🦀'.repeat(10) + ' +2')
  expect(kTokens(123456)).toBe('123k')
  expect(kTokens(undefined)).toBe('?')
})

import { barSvg } from './gauge'

test('svg bar is well-formed and fills to the percent', () => {
  const bar = barSvg(50, 'ok', 100, 45)
  expect(bar.startsWith('<svg')).toBe(true)
  expect(bar).toContain('width="50"')
  expect(barSvg(0, 'ok')).not.toContain('#4caf7d')
})
