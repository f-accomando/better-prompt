export type Limits = { five: number | null; seven: number | null }
export type Gauge = { percent: number; tokens?: number; window: number }
export type CrewMember = { type: string; status: string; description: string }
export type PlanState = { title: string; steps: { text: string; done: boolean }[] }
export type TopicState = { names: string[]; trail: ('same' | 'related' | 'new')[] }

declare module 'claude-code' {
  interface PluginState {
    'better-prompt': {
      judged: number
      gauge: Gauge | null
      crew: CrewMember[]
      limits: Limits | null
      topics: TopicState
      plan: PlanState | null
    }
  }
}
