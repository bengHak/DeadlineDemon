---
name: deadline
description: Arm a session deadline so the agent must finish on time. Use when the user says /deadline, /timer, or asks to finish within N minutes.
argument-hint: "[duration] [task]"
---

# DeadlineDemon

Arm a countdown for this session:

```
/deadline 8m "login page"
/deadline 5분 refactor auth
```

Check status: `deadline-demon status`
Reset: `deadline-demon reset`

When time runs out, stop new work, summarize, commit if applicable, and reply DONE.