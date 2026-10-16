import { test, expect } from 'claude-code/testing'

import {
  DEFAULT_KEEPWARM_MINUTES,
  clampKeepWarmMinutes,
  endsLoop,
  keepWarmEnabled,
  shouldPing,
} from './keepwarm'

test('keep warm is on only for an explicit true', () => {
  expect(keepWarmEnabled(true)).toBe(true)
  expect(keepWarmEnabled('true')).toBe(true)
  expect(keepWarmEnabled(false)).toBe(false)
  expect(keepWarmEnabled(undefined)).toBe(false)
  expect(keepWarmEnabled('yes')).toBe(false)
})

test('the interval stays between 1 and 4 minutes, 4 when unreadable', () => {
  expect(clampKeepWarmMinutes(2)).toBe(2)
  expect(clampKeepWarmMinutes(0)).toBe(1)
  expect(clampKeepWarmMinutes(30)).toBe(4)
  expect(clampKeepWarmMinutes('x')).toBe(DEFAULT_KEEPWARM_MINUTES)
  expect(clampKeepWarmMinutes(undefined)).toBe(DEFAULT_KEEPWARM_MINUTES)
})

test('a ping goes out only when the session is idle and the loop runs', () => {
  expect(shouldPing({ busy: false, stopped: false })).toBe(true)
  expect(shouldPing({ busy: true, stopped: false })).toBe(false)
  expect(shouldPing({ busy: false, stopped: true })).toBe(false)
})

test('only nothing-to-fork ends the loop', () => {
  expect(endsLoop({ isAnswered: false, reason: 'nothing-to-fork' })).toBe(true)
  expect(endsLoop({ isAnswered: false, reason: 'api-error' })).toBe(false)
  expect(endsLoop({ isAnswered: true })).toBe(false)
})
