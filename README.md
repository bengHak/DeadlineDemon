<p align="center">
  <img src="assets/banner.jpg" alt="DeadlineDemon — arm a deadline, nudge your agent to finish on time" width="360">
</p>

# DeadlineDemon

Cross-CLI hook tool that arms session deadlines and nudges AI agents to finish on time.

Works with **Codex CLI**, **Grok Build**, and **Claude Code**.

## Quick start

```bash
npm install
npm run build
npx deadline-demon install
```

Arm a **nudge-only** deadline in any hooked session:

```
/deadline 8m "login page"
/deadline 5분 refactor auth
```

Every user prompt injects remaining time and escalating urgency. Tool calls are **not** blocked.

## Two modes

| Mode | Arm command | Install | Behavior |
|------|-------------|---------|----------|
| **Nudge** (default) | `/deadline` | `deadline-demon install` | Countdown context each turn; tools always allowed |
| **Hard** (opt-in) | `/deadline-hard` | `deadline-demon install --hard` | Same countdown; after time-up, `PreToolUse` blocks non-wrap-up tools (git status/diff/add/commit still allowed) |

Hard mode requires **both** `install --hard` (registers the `PreToolUse` hook) **and** arming with `/deadline-hard`. Nudge mode never denies tools even if the `pre-tool-use` CLI is invoked manually.

## CLI

```bash
deadline-demon install [--dry-run] [--hard]
deadline-demon status [--session-id <id>]
deadline-demon reset [--session-id <id>]
```

## Install targets

| Harness | Path |
|---------|------|
| Grok | `~/.grok/plugins/deadline-demon/` |
| Codex | `~/.codex/plugins/deadline-demon/` |
| Claude | `~/.claude/hooks/deadline-demon.json` |

Enable the plugin in Codex/Grok (`/plugins`, `/hooks`) and trust project hooks if using repo-local copies.

## How it differs from timer hooks

Existing Claude timer hooks **report elapsed time**. DeadlineDemon **reminds the agent of a deadline**:

- `/deadline N` arms a nudge-only session timer
- Every prompt injects remaining time with escalating urgency
- Optional `/deadline-hard` + `install --hard` adds tool-call enforcement after time-up

## Grok note

If Grok ignores `UserPromptSubmit` stdout, nudge text may not appear. Tool blocking applies only when you opted into `install --hard` and armed with `/deadline-hard`; there is no silent hard fallback in the default install.

## License

MIT