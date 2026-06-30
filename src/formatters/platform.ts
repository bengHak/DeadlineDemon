export type Platform = "codex" | "claude" | "grok";

export function detectPlatform(env: NodeJS.ProcessEnv = process.env): Platform {
  if (env.GROK_HOOK_EVENT || env.GROK_SESSION_ID) return "grok";
  if (env.CLAUDE_CODE || env.CLAUDE_PROJECT_DIR) return "claude";
  if (env.CODEX_HOME) return "codex";
  return "codex";
}

export function detectPlatformFromInput(input: Record<string, unknown>): Platform {
  const event = input["hook_event_name"] ?? input["hookEventName"];
  if (typeof event === "string" && event.toLowerCase().includes("pre_tool")) {
    return "codex";
  }
  if ("hook_event_name" in input) return "codex";
  if ("hookEventName" in input) return "claude";
  return "codex";
}