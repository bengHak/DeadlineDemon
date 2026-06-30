# DeadlineDemon

Cross-CLI hook tool that arms session deadlines, injects countdown context every turn, and blocks tool calls when time is up.

Works with **Codex CLI**, **Grok Build**, and **Claude Code**.

## Quick start

```bash
npm install
npm run build
npx deadline-demon install
```

Arm a deadline in any hooked session:

```
/deadline 8m "login page"
/deadline 5분 refactor auth
```

## CLI

```bash
deadline-demon install [--dry-run]
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

Existing Claude timer hooks **report elapsed time**. DeadlineDemon **enforces a deadline**:

- `/deadline N` arms a session timer
- Every prompt injects remaining time
- After time-up, `PreToolUse` denies new tools (git commit still allowed)

## Grok fallback

If Grok ignores `UserPromptSubmit` stdout, countdown enforcement still applies via `PreToolUse` deny.

## License

MIT