/** Cache entries lapse after five minutes without a read; the default ping lands a minute before. */
export const DEFAULT_KEEPWARM_MINUTES = 4
export const MIN_KEEPWARM_MINUTES = 1
export const MAX_KEEPWARM_MINUTES = 4

/** What the ping asks the fork: the answer is thrown away, so the shortest reply is the cheapest. */
export const PING_PROMPT = 'Reply with the single character "." and nothing else.'

export function keepWarmEnabled(value: unknown): boolean {
  return value === true || value === 'true'
}

/** Minutes between pings, kept under the five-minute cache lifetime. */
export function clampKeepWarmMinutes(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_KEEPWARM_MINUTES
  return Math.min(MAX_KEEPWARM_MINUTES, Math.max(MIN_KEEPWARM_MINUTES, Math.round(n)))
}

export type PingState = { busy: boolean; stopped: boolean }

/** A ping goes out only while the session is idle: a running turn keeps the cache warm by itself. */
export function shouldPing(s: PingState): boolean {
  return !s.busy && !s.stopped
}

/** The only fork result that ends the loop: nothing was said yet (new session, after /clear). */
export function endsLoop(r: { isAnswered: boolean; reason?: string }): boolean {
  return !r.isAnswered && r.reason === 'nothing-to-fork'
}

export type WarmCommand = 'on' | 'off' | 'status'

/** `/keepwarm` argument: empty or `status` reports, `on`/`off` switch; anything else is refused with null. */
export function parseWarmCommand(args: string): WarmCommand | null {
  const a = args.trim().toLowerCase()
  if (a === '' || a === 'status') return 'status'
  if (a === 'on' || a === 'off') return a
  return null
}

export function warmStatusLine(on: boolean, minutes: number): string {
  return on
    ? `keep warm is on: a ping every ${minutes} min while the session is idle`
    : 'keep warm is off'
}
