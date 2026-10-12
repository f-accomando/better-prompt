import { test, expect } from 'claude-code/testing'

import { askText, isSkippable, parseVerdict } from './judge'

test('parses a weak verdict wrapped in prose', () => {
  const v = parseVerdict(
    'Sure: {"quality":"weak","rewrite":"Fix X in r3d.c","why":"names the file","thread":"new","topic":"GPU culling"}',
  )
  expect(v?.isWeak).toBe(true)
  expect(v?.thread).toBe('new')
  expect(v?.topic).toBe('GPU culling')
})

test('a good verdict or broken JSON never rewrites', () => {
  expect(parseVerdict('{"quality":"good","rewrite":"","why":"","thread":"same","topic":""}')?.isWeak).toBe(false)
  expect(parseVerdict('not json')).toBeNull()
  expect(parseVerdict('{"quality":"weak","rewrite":"","thread":"same"}')?.isWeak).toBe(false)
})

test('skips short prompts, slash commands and notes', () => {
  expect(isSkippable('ok')).toBe(true)
  expect(isSkippable('/compact now please do it')).toBe(true)
  expect(isSkippable('# remember this for later please')).toBe(true)
  expect(isSkippable('fix the bug in the loader that crashes')).toBe(false)
})

test('brief keeps the latest 30 turns and drops slash commands', () => {
  const turns = Array.from({ length: 40 }, (_, i) => `turn ${i}`)
  const text = askText([...turns, '/clear'], 'next step')
  expect(text).toContain('turn 39')
  expect(text).not.toContain('turn 9\n')
  expect(text).not.toContain('/clear')
})
