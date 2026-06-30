---
name: deadline
description: Arm a session deadline so the agent is nudged to finish on time. Use when the user says /deadline, /deadline-hard, /timer, or asks to finish within N minutes.
argument-hint: "[duration] [task]"
---

# DeadlineDemon

## Nudge-only (default)

Arm a countdown reminder for this session:

```
/deadline 8m "login page"
/deadline 5분 refactor auth
```

Each user turn receives remaining time and urgency text. Tool calls are not blocked.

## Hard enforcement (opt-in)

Requires `deadline-demon install --hard` on the user's machine **and**:

```
/deadline-hard 8m "login page"
```

After time runs out, non-wrap-up tool calls are blocked; safe git wrap-up (status, diff, add, commit) still works.

Check status: `deadline-demon status`
Reset: `deadline-demon reset`

When time runs out, stop new work, summarize, commit if applicable, and reply DONE.