import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CrewMember, Gauge, Limits } from '../types'
import { clampGauge, crabs, gaugeBar, gaugeLevel, kTokens } from './gauge'
import { crewAlt, crewSize, crewSvg, meterSize, meterSvg, type Meter } from './draw'
import { SYSTEM, askText, isSkippable, parseVerdict } from './judge'
import {
  adviceRows,
  divergence,
  emptyTopics,
  lastIsNew,
  recordVerdict,
  reset,
  resetKeepLast,
  topicCount,
  topicsLine,
} from './topics'

const gauge = atom({ plugin: 'better-prompt', key: 'gauge' } as const, null)
const limits = atom({ plugin: 'better-prompt', key: 'limits' } as const, null)
const topicsAtom = atom({ plugin: 'better-prompt', key: 'topics' } as const, emptyTopics())
const judged = atom({ plugin: 'better-prompt', key: 'judged' } as const, 0)
const crewAtom = atom({ plugin: 'better-prompt', key: 'crew' } as const, [] as CrewMember[])

// Statuses that keep a crab in the strip; the engine drops finished agents itself after a few seconds.
const CREW_STATUSES = ['pending', 'running', 'waiting', 'idle', 'completed', 'failed', 'killed']

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
  if (verdict.thread === 'new' && turns.length >= 2) {
    $.ui.toast(`New topic (${verdict.topic}): see the band above the prompt`)
  }
}

export const register: Register = (on, options) => {
  const model = typeof options.model === 'string' ? options.model : 'haiku'
  const warnAt = Number(options.sizeWarnPercent ?? 60)
  const gaugeAt = clampGauge(options.gaugeWarnPercent, 45)
  const divWarn = clampGauge(options.divergeWarnPercent, 50)

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
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($).catch(() => undefined)
    const result = await next(e)
    await classify($, model).catch(() => undefined)

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const g = await read($, gauge)
    const t = (await read($, topicsAtom)) ?? emptyTopics()
    const crew = (await read($, crewAtom)) ?? []
    const crabTotal = crew.length
    const hasTopics = t.names.length > 0 || t.trail.length > 0
    if (e.props.hasSurvey) return next(e)
    // Before the first classified prompt the row says why it is empty.
    const topicsText = hasTopics
      ? topicsLine(t)
      : 'topics 0 · counted from your next prompt'

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const Svg = 'Svg' in ui ? ui.Svg : null
    const lim = await read($, limits)
    const div = divergence(t)
    const rows = adviceRows({
      lastNew: lastIsNew(t),
      topic: t.names[t.names.length - 1] ?? '',
      topics: topicCount(t),
      div,
      ctxPercent: g?.percent ?? 0,
      warnAt,
      divWarn,
    })
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
    const ctxMeter = (c: Gauge) =>
      meter(
        'ctx',
        {
          label: 'ctx',
          value: ctxValue(c),
          percent: c.percent,
          level: gaugeLevel(c.percent, gaugeAt),
          mark: gaugeAt,
          hasCrab: true,
        },
        `${c.percent}%`,
      )
    const limitMeter = (key: string, label: string, percent: number) =>
      meter(
        key,
        { label, value: `${percent}%`, percent, level: gaugeLevel(percent, 90) },
        `${percent}%`,
      )

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
        {Svg === null ? (
          <Text color={LEVEL_COLOR[gaugeLevel(div, divWarn)]}>
            {`div ${div}% ${gaugeBar(div, divWarn)} · ${topicsText}`}
          </Text>
        ) : (
            meter(
              'div',
              {
                label: 'div',
                value: `${div}%`,
                percent: div,
                level: gaugeLevel(div, divWarn),
                note: topicsText,
              },
              `${div}%`,
            )
          )}
        {rows.map(r =>
          r.tone === 'amber' ? (
            <Text key={r.kind} color="yellow">
              {r.text}
            </Text>
          ) : (
            <Text key={r.kind} dimColor>
              {r.text}
            </Text>
          ),
        )}
      </Box>
    )
  })
}
