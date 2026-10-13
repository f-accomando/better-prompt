export type Step = { text: string; done: boolean }
export type Plan = { title: string; steps: Step[] }

export const MIN_STEPS = 2
export const MAX_STEPS = 6

export const PLAN_SYSTEM = [
  'You read a prompt a developer sent to a coding agent.',
  'If it asks for development work with 2 or more distinct points (features, fixes, checks), list them.',
  'Reply with ONE JSON object and nothing else:',
  '{"title":string,"steps":string[]}',
  'title: 2-5 words naming the task. steps: 2-6 points, each at most 6 words, in the order asked.',
  'For a question, a chat, or a task with a single point, reply {"title":"","steps":[]}.',
].join('\n')

export const DONE_SYSTEM = [
  'You get the steps of a task and the latest report of the coding agent working on it.',
  'Reply with ONE JSON object and nothing else: {"done":number[]}',
  'done: the 1-based numbers of the steps the report shows as finished. Do not guess: leave out steps not clearly finished.',
].join('\n')

function json(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (match === null) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

/** A plan from the model's reply, or null when it names fewer than two points. */
export function parsePlan(raw: string): Plan | null {
  const data = json(raw)
  if (data === null || !Array.isArray(data.steps)) return null
  const steps = data.steps
    .filter((s): s is string => typeof s === 'string')
    .map(s => s.replace(/\s+/g, ' ').trim().slice(0, 40))
    .filter(s => s.length > 0)
    .slice(0, MAX_STEPS)
  if (steps.length < MIN_STEPS) return null
  const title = typeof data.title === 'string' ? data.title.trim().slice(0, 40) : ''
  return { title, steps: steps.map(text => ({ text, done: false })) }
}

export function planAsk(prompt: string): string {
  return `Prompt:\n${prompt.slice(0, 4000)}`
}

export function doneAsk(plan: Plan, report: string): string {
  const list = plan.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')
  return `Steps:\n${list}\n\nLatest report:\n${report.slice(0, 3000)}`
}

/** Marks the steps the reply lists as done. Steps already done stay done. */
export function applyDone(plan: Plan, raw: string): Plan {
  const data = json(raw)
  const done = data !== null && Array.isArray(data.done) ? data.done : []
  const set = new Set(done.filter((n): n is number => typeof n === 'number'))
  return { ...plan, steps: plan.steps.map((s, i) => ({ ...s, done: s.done || set.has(i + 1) })) }
}

export function doneCount(plan: Plan): number {
  return plan.steps.filter(s => s.done).length
}

/** Index of the step being worked on: the first one not done, or -1 when all are. */
export function currentStep(plan: Plan): number {
  return plan.steps.findIndex(s => !s.done)
}

export function isFinished(plan: Plan): boolean {
  return plan.steps.length > 0 && currentStep(plan) === -1
}

/** `task 2/4 · step text` for the line under the bar. */
export function planLine(plan: Plan): string {
  const cur = currentStep(plan)
  const head = `${plan.title.length > 0 ? plan.title : 'task'} ${doneCount(plan)}/${plan.steps.length}`
  return cur === -1 ? `${head} · done` : `${head} · ${plan.steps[cur].text}`
}
