import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CrewMember, Gauge, Limits } from '../types'
import { clampGauge, crabs, gaugeBar, gaugeLevel, kTokens } from './gauge'
import { crewAlt, crewSize, crewSvg, meterSize, meterSvg, planBarSvg, planSize, CTX_H, METER_BAR_W, METER_LABEL_W, type Meter } from './draw'
import { DONE_SYSTEM, PLAN_SYSTEM, applyDone, doneAsk, doneCount, isFinished, parsePlan, planAsk, planLine, planValue, type Plan } from './plan'
import { STATE_PATH, buildState, stateText } from './state'
import { PING_PROMPT, clampKeepWarmMinutes, endsLoop, keepWarmEnabled, parseWarmCommand, shouldPing, warmStatusLine } from './keepwarm'
import { SYSTEM, askText, isSkippable, parseVerdict } from './judge'
import {
  divergence,
  emptyTopics,
  recordVerdict,
  reset,
  resetKeepLast,
  topicCount,
} from './topics'

const gauge = atom({ plugin: 'better-prompt', key: 'gauge' } as const, null)
const limits = atom({ plugin: 'better-prompt', key: 'limits' } as const, null)
const topicsAtom = atom({ plugin: 'better-prompt', key: 'topics' } as const, emptyTopics())
const judged = atom({ plugin: 'better-prompt', key: 'judged' } as const, 0)
const planAtom = atom({ plugin: 'better-prompt', key: 'plan' } as const, null as Plan | null)
const crewAtom = atom({ plugin: 'better-prompt', key: 'crew' } as const, [] as CrewMember[])

// Statuses that keep a crab in the strip; the engine drops finished agents itself after a few seconds.
const CREW_STATUSES = ['pending', 'running', 'waiting', 'idle', 'completed', 'failed', 'killed']

// Pixels of the two terminal cells between band items (gap={2}); tune if the bar ends short of or past 7d.
const CELL_GAP_PX = 16

const TOPIC_MAX = 5
const TOPIC_WARN = 3

const LEVEL_COLOR = { ok: 'green', near: 'yellow', over: 'red' } as const

// Display-only: reads the window and the running subagents into the atoms the band draws.
async function refresh($: EngineInterface) {
  const { context, rateLimits } = await $.session.usage()
  const g: Gauge = {
    percent: context.percent ?? 0,
    tokens: context.tokens,
    window: context.window,
  }
  await update($, gauge, () => g)
  const pick = (kind: string) => rateLimits.find(r => r.kind === kind)?.percentUsed ?? null
  const l: Limits = { five: pick('five_hour'), seven: pick('seven_day') }
  await update($, limits, () => l)
  const agents = await $.agent.list()
  const crew: CrewMember[] = agents
    .filter(a => a.type !== 'teammate' && CREW_STATUSES.includes(a.status))
    .map(a => ({ type: a.type, status: a.status, description: a.description }))
  await update($, crewAtom, () => crew)
}

// Counts topics only: classifies the newest prompt of the main conversation after the turn. Never touches a prompt.
async function classify($: EngineInterface, model: string) {
  const turns = (await $.session.messages())
    .filter(m => m.role === 'user' && (m.toolResults ?? []).length === 0)
    .map(m => m.text)
  const seen = (await read($, judged)) ?? 0
  await update($, judged, () => turns.length)
  if (turns.length <= seen) return
  const text = turns[turns.length - 1]
  if (isSkippable(text)) return
  const r = await $.model.complete({
    model,
    system: SYSTEM,
    prompt: askText(turns.slice(0, -1), text),
    effort: 'low',
    maxTokens: 300,
    timeoutMs: 10000,
  })
  const verdict = r.isAnswered ? parseVerdict(r.text) : null
  if (verdict === null) return
  await update($, topicsAtom, t =>
    recordVerdict(turns.length === 1 ? reset() : (t ?? emptyTopics()), verdict),
  )
}

// Task bar, step 1: when a prompt is sent, list its points. Runs beside the prompt and never holds it.
async function makePlan($: EngineInterface, model: string, text: string) {
  if (isSkippable(text)) return
  const r = await $.model.complete({
    model,
    system: PLAN_SYSTEM,
    prompt: planAsk(text),
    effort: 'low',
    maxTokens: 300,
    timeoutMs: 10000,
  })
  const plan = r.isAnswered ? parsePlan(r.text) : null
  await update($, planAtom, () => plan)
}

// Task bar, step 2: after a turn, tick the points the agent's last report shows as finished.
async function advancePlan($: EngineInterface, model: string) {
  const plan = await read($, planAtom)
  if (plan == null || isFinished(plan)) return
  const last = (await $.session.messages()).filter(m => m.role === 'assistant').pop()
  if (last === undefined || last.text.trim().length === 0) return
  const r = await $.model.complete({
    model,
    system: DONE_SYSTEM,
    prompt: doneAsk(plan, last.text),
    effort: 'low',
    maxTokens: 100,
    timeoutMs: 10000,
  })
  if (!r.isAnswered) return
  await update($, planAtom, p => (p == null ? p : applyDone(p, r.text)))
}

// Leaves the numbers for an outside hook (e.g. a UserPromptSubmit guard). Failures are swallowed by callers.
async function exportState($: EngineInterface) {
  const { context } = await $.session.usage()
  const topics = (await read($, topicsAtom)) ?? emptyTopics()
  const root = await $.session.root()
  const text = stateText(buildState({ context, topics, now: new Date() }))
  await $.fs.write(`${root}/${STATE_PATH}`, text)
}

// Keep-warm loop state: one timer per session, restarted after every turn.
let warmTimer: { cancel: () => void } | null = null
let turnBusy = false
let warmStopped = false
let warmOn = false

// Reads the whole cached conversation back through a fork, which renews the cache entry; the reply is dropped.
async function ping($: EngineInterface) {
  if (!shouldPing({ busy: turnBusy, stopped: warmStopped })) return
  const r = await $.model.fork({ prompt: PING_PROMPT })
  if (endsLoop(r)) stopWarm()
}

function stopWarm() {
  warmStopped = true
  warmTimer?.cancel()
  warmTimer = null
}

function startWarm($: EngineInterface, minutes: number) {
  warmTimer?.cancel()
  warmStopped = false
  warmTimer = $.clock.every(minutes * 60_000, () => {
    void ping($).catch(() => undefined)
  })
}

export const register: Register = (on, options) => {
  const model = typeof options.model === 'string' ? options.model : 'haiku'
  const gaugeAt = clampGauge(options.gaugeWarnPercent, 45)
  const divWarn = clampGauge(options.divergeWarnPercent, 50)
  warmOn = keepWarmEnabled(options.keepWarm)
  const warmMinutes = clampKeepWarmMinutes(options.keepWarmMinutes)

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refresh($).catch(() => undefined)

    return result
  })

  // Observes only: after a real compaction of the main conversation, keep just the current topic.
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (!('skip' in r) && e.trigger !== 'precompute' && e.agentId === undefined) {
      await update($, topicsAtom, t => resetKeepLast(t ?? emptyTopics())).catch(() => undefined)
      await exportState($).catch(() => undefined)
    }

    return r
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'keepwarm',
      description: 'Keep the prompt cache warm while idle: on, off or status',
      argumentHint: 'on|off|status',
    })

    return next(e)
  })

  // Switches the loop for this session only; the saved setting is what a restart starts from.
  on('command.run', { command: 'keepwarm' }, async ($, e) => {
    const cmd = parseWarmCommand(e.args)
    if (cmd === null) return { text: 'Usage: /keepwarm on|off|status' }
    if (cmd === 'on') {
      warmOn = true
      if (!turnBusy) startWarm($, warmMinutes)
    } else if (cmd === 'off') {
      warmOn = false
      stopWarm()
    }

    return { text: warmStatusLine(warmOn, warmMinutes) }
  })

  on('prompt.submit', async ($, e, next) => {
    turnBusy = true
    void makePlan($, model, e.text).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($).catch(() => undefined)
    const result = await next(e)
    await classify($, model).catch(() => undefined)
    await advancePlan($, model).catch(() => undefined)
    await exportState($).catch(() => undefined)
    if (e.agentId === undefined) {
      turnBusy = false
      if (warmOn) startWarm($, warmMinutes)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const g = await read($, gauge)
    const t = (await read($, topicsAtom)) ?? emptyTopics()
    const crew = (await read($, crewAtom)) ?? []
    const crabTotal = crew.length
    if (e.props.hasSurvey) return next(e)
    const topicN = topicCount(t)
    // The topic bar runs 0-5 with its tick at 3, where the divergence mark sits.
    const topicPct = Math.min(100, (topicN / TOPIC_MAX) * 100)

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const Svg = 'Svg' in ui ? ui.Svg : null
    const lim = await read($, limits)
    const div = divergence(t)
    const ctxValue = (c: Gauge) =>
      `${c.percent}%${c.tokens === undefined ? '' : ` ${kTokens(c.tokens)}`}`
    // One SVG per meter (label, bar, value), all the same height, so the three sit on one line.
    const meter = (key: string, m: Meter, text: string) =>
      Svg === null ? (
        <Text key={key} color={LEVEL_COLOR[m.level]}>
          {`${m.label} ${gaugeBar(m.percent, m.mark ?? 100)} ${text}  `}
        </Text>
      ) : (
        <Svg
          key={key}
          source={meterSvg(m)}
          alt={`${m.label} ${m.value}`}
          width={meterSize(m).width}
          height={meterSize(m).height}
        />
      )
    const ctxSpec = (c: Gauge): Meter => ({
      label: 'ctx',
      value: ctxValue(c),
      percent: c.percent,
      level: gaugeLevel(c.percent, gaugeAt),
      mark: gaugeAt,
      hasCrab: true,
    })
    const limitSpec = (label: string, percent: number): Meter => ({
      label,
      value: `${percent}%`,
      percent,
      level: gaugeLevel(percent, 90),
    })
    const ctxMeter = (c: Gauge) => meter('ctx', ctxSpec(c), `${c.percent}%`)
    const limitMeter = (key: string, label: string, percent: number) =>
      meter(key, limitSpec(label, percent), `${percent}%`)
    // The task bar starts where the first bar starts and ends where the last bar ends (not at its value text).
    const meters: Meter[] = [
      ...(g !== null ? [ctxSpec(g)] : []),
      ...(lim?.five != null ? [limitSpec('5h', lim.five)] : []),
      ...(lim?.seven != null ? [limitSpec('7d', lim.seven)] : []),
    ]
    const lastMeter = meters[meters.length - 1]
    const planWidth =
      meters.reduce((sum, m) => sum + meterSize(m).width, 0) +
      Math.max(0, meters.length - 1) * CELL_GAP_PX -
      (lastMeter === undefined ? 0 : meterSize(lastMeter).width - METER_LABEL_W - METER_BAR_W)
    const plan = await read($, planAtom)
    const showPlan = Svg !== null && plan != null && meters.length > 0

    return (
      <Box flexDirection="column">
        {(g !== null || lim !== null || crabTotal > 0) && (
          <Box justifyContent="space-between" alignItems="flex-end">
            <Box gap={2} alignItems="flex-end">
              {g !== null && ctxMeter(g)}
              {lim?.five != null && limitMeter('h5', '5h', lim.five)}
              {lim?.seven != null && limitMeter('d7', '7d', lim.seven)}
            </Box>
            {crabTotal > 0 &&
              (Svg === null ? (
                <Text>{`${crabs(crabTotal)} ${crabTotal}`}</Text>
              ) : (
                <Svg
                  source={crewSvg(crew)}
                  alt={crewAlt(crew)}
                  width={crewSize(crew).width}
                  height={crewSize(crew).height}
                />
              ))}
          </Box>
        )}
        {showPlan && plan != null && Svg !== null && (
          <Svg
            source={planBarSvg(plan.steps, `${doneCount(plan)}/${plan.steps.length}`, planWidth, planValue(plan))}
            alt={planLine(plan)}
            width={planSize(planWidth, planValue(plan)).width}
            height={CTX_H}
          />
        )}
        {Svg === null ? (
          <Text color={LEVEL_COLOR[gaugeLevel(div, divWarn)]}>
            {`div ${div}% ${gaugeBar(div, divWarn)} · topics ${topicN}`}
          </Text>
        ) : (
          <Box gap={2} alignItems="flex-end">
            {meter(
              'div',
              {
                label: 'div',
                value: `${div}%`,
                percent: div,
                level: gaugeLevel(div, divWarn),
                padTo: g === null ? undefined : meterSize(ctxSpec(g)).width,
              },
              `${div}%`,
            )}
            {meter(
              'topic',
              {
                label: 'topic',
                labelSize: 10,
                value: String(topicN),
                percent: topicPct,
                level: gaugeLevel(topicPct, (TOPIC_WARN / TOPIC_MAX) * 100),
                mark: (TOPIC_WARN / TOPIC_MAX) * 100,
              },
              String(topicN),
            )}
          </Box>
        )}
      </Box>
    )
  })
}
