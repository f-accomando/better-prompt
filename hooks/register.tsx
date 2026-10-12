import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CrewMember, Gauge, Limits, Suggestion } from '../types'
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

const suggestion = atom({ plugin: 'better-prompt', key: 'suggestion' } as const, null)
const enabled = atom({ plugin: 'better-prompt', key: 'enabled' } as const, null)
const gauge = atom({ plugin: 'better-prompt', key: 'gauge' } as const, null)
const limits = atom({ plugin: 'better-prompt', key: 'limits' } as const, null)
const topicsAtom = atom({ plugin: 'better-prompt', key: 'topics' } as const, emptyTopics())
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

export const register: Register = (on, options) => {
  const model = typeof options.model === 'string' ? options.model : 'haiku'
  const warnAt = Number(options.sizeWarnPercent ?? 60)
  const gaugeAt = clampGauge(options.gaugeWarnPercent, 45)
  const divWarn = clampGauge(options.divergeWarnPercent, 50)
  const assist = options.promptAssist !== false
  const autoRewrite = options.autoRewrite !== false

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refresh($).catch(() => undefined)

    return result
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bp',
      description: 'better-prompt: on | off | status',
      argumentHint: 'on|off|status',
    })

    return next(e)
  })

  on('command.run', { command: 'bp' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      await update($, enabled, () => arg === 'on')
      if (arg === 'off') await update($, suggestion, () => null)
    }
    const now = (await read($, enabled)) ?? assist
    const t = (await read($, topicsAtom)) ?? emptyTopics()
    const counts = `topics ${topicCount(t)}, divergence ${divergence(t)}%`

    return {
      text: now
        ? `prompt assist on: weak prompts are rewritten, topic changes flagged. Start a prompt with ! to send it untouched. ${counts}.`
        : `prompt assist off: prompts go through untouched. The context band stays. ${counts}.`,
    }
  })

  // Observes only: after a real compaction of the main conversation, keep just the current topic.
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (!('skip' in r) && e.trigger !== 'precompute' && e.agentId === undefined) {
      await update($, topicsAtom, t => resetKeepLast(t ?? emptyTopics())).catch(() => undefined)
    }

    return r
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer') return next(e)

    if (!((await read($, enabled)) ?? assist)) return next(e)

    if (e.text.startsWith('!')) {
      return next({ ...e, text: e.text.slice(1).trimStart() })
    }

    const pending = await read($, suggestion)
    if (pending !== null && e.text.trim() === pending.rewrite) {
      await update($, suggestion, () => null)
      return next(e)
    }

    if (isSkippable(e.text) || e.attachments !== undefined) return next(e)

    const turns = (await $.session.messages())
      .filter(m => m.role === 'user' && (m.toolResults ?? []).length === 0)
      .map(m => m.text)

    const r = await $.model.complete({
      model,
      system: SYSTEM,
      prompt: askText(turns, e.text),
      effort: 'low',
      maxTokens: 700,
      timeoutMs: 10000,
    })
    const verdict = r.isAnswered ? parseVerdict(r.text) : null
    if (verdict === null) return next(e)

    // Recorded before the rewrite branch: a prompt dropped for a rewrite is not judged again when resent.
    await update($, topicsAtom, t =>
      recordVerdict(turns.length === 0 ? reset() : (t ?? emptyTopics()), verdict),
    )

    if (autoRewrite && verdict.isWeak && verdict.rewrite !== e.text.trim()) {
      const s: Suggestion = { rewrite: verdict.rewrite, why: verdict.why }
      await update($, suggestion, () => s)
      await $.prompt.fill({ text: verdict.rewrite, mode: 'replace' })

      return {
        drop: `better-prompt: ${verdict.why || 'sharper version'} in the box. Enter sends it; "!" + your original sends that.`,
      }
    }

    if (verdict.thread === 'new' && turns.length >= 2) {
      $.ui.toast(`New topic (${verdict.topic}): see the band above the prompt`)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await refresh($).catch(() => undefined)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, suggestion)
    const g = await read($, gauge)
    const t = (await read($, topicsAtom)) ?? emptyTopics()
    const crew = (await read($, crewAtom)) ?? []
    const crabTotal = crew.length
    const hasTopics = t.names.length > 0 || t.trail.length > 0
    if (e.props.hasSurvey) return next(e)
    const isAssisting = (await read($, enabled)) ?? assist
    // Before the first judged prompt (or with assist off) the row says why it is empty.
    const topicsText = hasTopics
      ? topicsLine(t)
      : isAssisting
        ? 'topics 0 · counted from your next prompt'
        : 'topics 0 · prompt assist off, /bp on to count'

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
            <Box gap={2} alignItems="flex-end">
              {meter(
                'div',
                { label: 'div', value: `${div}%`, percent: div, level: gaugeLevel(div, divWarn) },
                `${div}%`,
              )}
              <Text dimColor>{topicsText}</Text>
            </Box>
          )}
        {s !== null && (
          <Text dimColor>
            better-prompt: rewritten ({s.why}). Enter to send.
          </Text>
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
