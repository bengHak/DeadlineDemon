---
name: deadline
description: Arm a session deadline so the agent is nudged to finish on time. Use when the user says /deadline, /deadline-hard, /timer, or asks to finish within N minutes.
argument-hint: "[duration] [task]"
---

# DeadlineDemon

Install once: `codex plugin marketplace add bengHak/DeadlineDemon`, then `codex plugin add deadline-demon@deadline-demon`.

## Nudge (default)

```
/deadline 8 "login page"
/deadline 5 refactor auth
```

Minutes only, 1 to 1440 — no unit suffix (`8`, not `8m`).

Each user turn receives remaining time and urgency text. Tool calls are not blocked.

## Hard enforcement

```
/deadline-hard 8 "login page"
```

Same countdown, but after time runs out non-wrap-up tool calls are blocked; safe git wrap-up (status, diff, add, commit) still works.

Check status: `npx deadline-demon status`
Reset: `npx deadline-demon reset`

When time runs out, stop new work, summarize, commit if applicable, and reply DONE.
