# better-prompt

A Claude Code mod that keeps an eye on your session: it sharpens weak prompts before they are sent, tells you
when the conversation drifts across topics, and shows how much context and allowance you have used, with an
animated pixel crab on the bar.

## What it does

- **Status band above the prompt** (desktop app draws SVG; a terminal falls back to text):
  - `ctx` bar with the context window fill, a tick at your threshold, and a crab standing on the fill end.
    The crab looks happy, neutral or worried as the context fills.
  - `5h` and `7d` bars with the share of your rate-limit windows used.
  - One crab per running subagent. Colour follows the agent type, an accessory follows its role (magnifier for
    Explore, cap for light, glasses for careful, helmet for deep, crown for fable, clipboard for plan) and the mood
    follows its status: walking, asleep, happy when done, worried on failure.
  - `div` meter and `topics N` list: how many different topics the chat has taken on and how far it diverges.
- **Prompt assist** (optional): a cheap model reads your earlier prompts and the new one. A weak prompt is not
  sent; a sharper version is put in the box and Enter sends it (`!` before your text sends it untouched). The same
  call flags a new topic.
- **Advice as plain text**, never clickable: when a new topic starts, the chat diverges, or the context fills up,
  the band suggests `/clear`, `/compact` (prune) or `/rewind` (undo). You type the command yourself.

## Install

```
/plugin install better-prompt --marketplace f-accomando/better-prompt
```

Answer `y` to add the marketplace, then pick a scope. (The `/plugin` command is available in a terminal session,
not in the desktop app's Code tab; a mod installed from a terminal at user scope also loads in the desktop app.)
To try it from a clone without installing:

```
claude --plugin-dir /path/to/better-prompt
```

## Settings

Open them in the config menu (`/config`).

| Setting | Default | Meaning |
| --- | --- | --- |
| `promptAssist` | on | Judge each prompt, rewrite weak ones, flag topic changes. Off leaves prompts untouched; the band stays. |
| `model` | haiku | Model that judges and rewrites (a cheap one is enough). |
| `autoRewrite` | on | With assist on, put a sharper prompt in the box instead of sending a weak one. |
| `sizeWarnPercent` | 60 | Suggest `/compact` when the context window is this full. |
| `gaugeWarnPercent` | 45 | Where the context bar marks its limit (10-95); only colours the bar. |
| `divergeWarnPercent` | 50 | Divergence level that colours the meter and triggers the advice. |

`/bp on`, `/bp off` and `/bp status` switch the assist inside a session and report topics and divergence.

## How the numbers are made

- Context and the 5h/7d windows come from the session's own usage figures, refreshed after each response.
- Each judged prompt is `same`, `related` or `new`. Topics are the `new` ones; divergence is the weighted share of
  the last 10 judged prompts (new = 1, related = 0.4). A `/clear` or a compact resets the count.
- Suggestions never run anything: nothing in the mod calls `/clear`, `/compact` or `/rewind`.

## Costs

With assist on, each prompt of 20 characters or more costs one small model call (haiku by default) over a brief of
your last 30 prompts. Turn `promptAssist` off to avoid it.

## Develop

`claude plugin validate .` and `claude plugin test .` from the repository folder. The hooks are in
`hooks/register.tsx`, the SVG drawing in `hooks/draw.ts`, the topic logic in `hooks/topics.ts`, the judge prompt in
`hooks/judge.ts`. The crab sprite follows [crab-ledger](https://github.com/f-accomando/crab-ledger).
