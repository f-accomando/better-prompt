export type Verdict = {
  isWeak: boolean
  rewrite: string
  why: string
  thread: 'same' | 'related' | 'new'
  topic: string
}

export const SYSTEM = [
  'You classify the next prompt a developer sent to a coding agent against the session so far.',
  'You get a brief of the session (their earlier prompts, oldest first) and the new prompt.',
  'Reply with ONE JSON object and nothing else:',
  '{"thread":"same"|"related"|"new","topic":string}',
  'thread: same = continues the current work; related = same project area but a new step; new = unrelated to the recent work.',
  'topic: 3-6 words naming what the new prompt is about.',
].join('\n')

export function brief(userTurns: readonly string[]): string {
  const rows = userTurns
    .map(t => t.replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 0 && !t.startsWith('/'))
    .slice(-30)
    .map((t, i) => `${i + 1}. ${t.slice(0, 160)}`)
  return rows.length === 0 ? '(session just started)' : rows.join('\n')
}

export function askText(userTurns: readonly string[], prompt: string): string {
  return `Session brief:\n${brief(userTurns)}\n\nNew prompt:\n${prompt.slice(0, 4000)}`
}

export function parseVerdict(raw: string): Verdict | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (match === null) return null
  let data: Record<string, unknown>
  try {
    data = JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
  const thread = data.thread
  const rewrite = typeof data.rewrite === 'string' ? data.rewrite.trim() : ''
  return {
    isWeak: data.quality === 'weak' && rewrite.length > 0,
    rewrite,
    why: typeof data.why === 'string' ? data.why.trim() : '',
    thread: thread === 'new' || thread === 'related' ? thread : 'same',
    topic: typeof data.topic === 'string' ? data.topic.trim().slice(0, 60) : '',
  }
}

export function isSkippable(text: string): boolean {
  const t = text.trim()
  return t.length < 20 || t.startsWith('/') || t.startsWith('#')
}
