export type Suggestion = { rewrite: string; why: string }
export type Limits = { five: number | null; seven: number | null }
export type Gauge = { percent: number; tokens?: number; window: number }
export type CrewMember = { type: string; status: string; description: string }
export type TopicState = { names: string[]; trail: ('same' | 'related' | 'new')[] }

declare module 'claude-code' {
  interface PluginState {
    'better-prompt': {
      suggestion: Suggestion | null
      enabled: boolean | null
      gauge: Gauge | null
      crew: CrewMember[]
      limits: Limits | null
      topics: TopicState
    }
  }
}
