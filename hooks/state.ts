import { divergence, type Topics } from './topics'

/** Where, under the project root, the mod leaves its numbers for external hooks to read. */
export const STATE_PATH = '.claude/state/better-prompt.json'

export type ExportedState = {
  percent: number
  tokens: number
  window: number
  topics: string[]
  div: number
  updated: string
}

export type ExportInput = {
  context: { percent?: number | null; tokens?: number | null; window: number }
  topics: Topics
  now: Date
}

/** The JSON object an outside hook reads: exact context figures, topic names, divergence. */
export function buildState({ context, topics, now }: ExportInput): ExportedState {
  return {
    percent: context.percent ?? 0,
    tokens: context.tokens ?? 0,
    window: context.window,
    topics: [...topics.names],
    div: divergence(topics),
    updated: now.toISOString(),
  }
}

export function stateText(state: ExportedState): string {
  return `${JSON.stringify(state, null, 2)}\n`
}
