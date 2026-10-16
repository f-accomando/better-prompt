import { test, expect } from 'claude-code/testing'

import {
  divergence,
  emptyTopics,
  lastIsNew,
  recordVerdict,
  reset,
  resetKeepLast,
  topicCount,
  topicsLine,
  type Topics,
} from './topics'

test('the first judged prompt is the first topic, whatever its thread', () => {
  const s = recordVerdict(emptyTopics(), { thread: 'same', topic: 'GPU culling' })
  expect(s.names).toEqual(['GPU culling'])
  expect(s.trail).toEqual(['same'])
  expect(lastIsNew(s)).toBe(false)
})

test('new topics are added unique-last, capped at 8; trail keeps 10', () => {
  let s: Topics = emptyTopics()
  s = recordVerdict(s, { thread: 'new', topic: 'a' })
  s = recordVerdict(s, { thread: 'same', topic: 'ignored' })
  s = recordVerdict(s, { thread: 'new', topic: 'b' })
  s = recordVerdict(s, { thread: 'new', topic: 'a' })
  expect(s.names).toEqual(['b', 'a'])
  expect(topicCount(s)).toBe(2)
  expect(lastIsNew(s)).toBe(true)
  for (let i = 0; i < 12; i += 1) s = recordVerdict(s, { thread: 'new', topic: `t${i}` })
  expect(s.names).toHaveLength(8)
  expect(s.names[7]).toBe('t11')
  expect(s.trail).toHaveLength(10)
})

test('divergence weighs new 1 and related 0.4, 0 on an empty trail', () => {
  expect(divergence(emptyTopics())).toBe(0)
  const s: Topics = { names: ['x'], trail: ['new', 'related', 'same', 'same', 'same'] }
  expect(divergence(s)).toBe(28)
  expect(divergence({ names: [], trail: ['new', 'new'] })).toBe(100)
})

test('reset empties; resetKeepLast keeps only the last topic', () => {
  const s: Topics = { names: ['a', 'b', 'c'], trail: ['new', 'new'] }
  expect(reset(s)).toEqual({ names: [], trail: [] })
  expect(resetKeepLast(s)).toEqual({ names: ['c'], trail: [] })
  expect(resetKeepLast(emptyTopics())).toEqual({ names: [], trail: [] })
})

test('topics line lists the last three names, cut with an ellipsis', () => {
  expect(topicsLine({ names: ['a', 'b', 'c', 'd'], trail: [] })).toBe('topics 4 · b, c, d')
  const long = topicsLine({ names: ['x'.repeat(50), 'y'.repeat(50)], trail: [] })
  expect(long.endsWith('…')).toBe(true)
  expect(long.length <= 'topics 2 · '.length + 60).toBe(true)
})
