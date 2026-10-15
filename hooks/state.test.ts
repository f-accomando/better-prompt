import { test, expect } from 'claude-code/testing'

import { STATE_PATH, buildState, stateText } from './state'
import { emptyTopics, recordVerdict } from './topics'

const now = new Date('2026-10-15T10:00:00.000Z')

test('state carries the exact context figures, topics, divergence and timestamp', () => {
  let t = recordVerdict(emptyTopics(), { thread: 'same', topic: 'GPU culling' })
  t = recordVerdict(t, { thread: 'new', topic: 'audio mixer' })
  const s = buildState({ context: { percent: 62, tokens: 124500, window: 200000 }, topics: t, now })
  expect(s).toEqual({
    percent: 62,
    tokens: 124500,
    window: 200000,
    topics: ['GPU culling', 'audio mixer'],
    div: 50,
    updated: '2026-10-15T10:00:00.000Z',
  })
})

test('missing figures become 0 and an empty chat has no topics', () => {
  const s = buildState({ context: { percent: null, window: 1000 }, topics: emptyTopics(), now })
  expect(s.percent).toBe(0)
  expect(s.tokens).toBe(0)
  expect(s.topics).toEqual([])
  expect(s.div).toBe(0)
})

test('the state does not alias the live topic list', () => {
  const t = recordVerdict(emptyTopics(), { thread: 'new', topic: 'a' })
  const s = buildState({ context: { percent: 1, tokens: 1, window: 2 }, topics: t, now })
  s.topics.push('x')
  expect(t.names).toEqual(['a'])
})

test('stateText is parseable JSON ending in a newline; path is under .claude/state', () => {
  const s = buildState({ context: { percent: 5, tokens: 10, window: 200 }, topics: emptyTopics(), now })
  const text = stateText(s)
  expect(text.endsWith('\n')).toBe(true)
  expect(JSON.parse(text)).toEqual(s)
  expect(STATE_PATH).toBe('.claude/state/better-prompt.json')
})
