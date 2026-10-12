export type Thread = 'same' | 'related' | 'new'

export type Topics = { names: string[]; trail: Thread[] }

export const MAX_TRAIL = 10
export const MAX_NAMES = 8

export function emptyTopics(): Topics {
  return { names: [], trail: [] }
}

function pushName(names: readonly string[], name: string): string[] {
  const out = names.filter(n => n !== name)
  out.push(name)
  return out.slice(-MAX_NAMES)
}

/** Adds one judged prompt: its thread on the trail, its topic on the names when it opens one. */
export function recordVerdict(state: Topics, verdict: { thread: Thread; topic: string }): Topics {
  const trail = [...state.trail, verdict.thread].slice(-MAX_TRAIL)
  const topic = verdict.topic.trim()
  const opens = verdict.thread === 'new' || state.names.length === 0
  const names = opens && topic.length > 0 ? pushName(state.names, topic) : [...state.names]
  return { names, trail }
}

export function topicCount(state: Topics): number {
  return state.names.length
}

/** 0..100: share of recent prompts that left the thread, a related step counting 0.4. */
export function divergence(state: Topics): number {
  if (state.trail.length === 0) return 0
  let score = 0
  for (const t of state.trail) {
    if (t === 'new') score += 1
    else if (t === 'related') score += 0.4
  }
  return Math.round((100 * score) / state.trail.length)
}

export function reset(_state?: Topics): Topics {
  return emptyTopics()
}

export function resetKeepLast(state: Topics): Topics {
  const last = state.names[state.names.length - 1]
  return { names: last === undefined ? [] : [last], trail: [] }
}

/** True when the last judged prompt opened a topic other than the first one. */
export function lastIsNew(state: Topics): boolean {
  return state.trail[state.trail.length - 1] === 'new' && state.names.length >= 2
}

export function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** `topics 3 · a, b, c`: the count and the names of the last three, cut at `max` chars. */
export function topicsLine(state: Topics, max = 60): string {
  const names = state.names.slice(-3).join(', ')
  const head = `topics ${state.names.length}`
  return names.length === 0 ? head : `${head} · ${cut(names, max)}`
}

export type AdviceInput = {
  lastNew: boolean
  topic: string
  topics: number
  div: number
  ctxPercent: number
  warnAt: number
  divWarn: number
}

export type AdviceRow = { kind: 'branch' | 'diverge' | 'size'; text: string; tone: 'amber' | 'dim' }

/** The suggestion rows for the band, most relevant first, at most two. Text only: nothing runs. */
export function adviceRows(a: AdviceInput): AdviceRow[] {
  const rows: AdviceRow[] = []
  if (a.lastNew) {
    rows.push({
      kind: 'branch',
      tone: 'amber',
      text: `New topic "${a.topic}". Unrelated? type /clear. Still need the old work? /compact to prune it, or /rewind to undo.`,
    })
  }
  if (a.topics >= 3 || a.div >= a.divWarn) {
    rows.push({
      kind: 'diverge',
      tone: 'amber',
      text: `Chat is diverging (${a.topics} topics, ${a.div}%). /compact to prune what the current topic does not need, or /clear to start fresh.`,
    })
  }
  if (a.ctxPercent >= a.warnAt) {
    rows.push({ kind: 'size', tone: 'dim', text: `Context ${a.ctxPercent}% full. /compact to shrink it.` })
  }
  return rows.slice(0, 2)
}
