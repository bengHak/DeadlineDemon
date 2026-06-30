export type Platform = "codex" | "claude" | "grok";

export function detectPlatform(env: NodeJS.ProcessEnv = process.env): Platform {
  if (env.GROK_HOOK_EVENT || env.GROK_SESSION_ID || env.GROK_HOOK_NAME) return "grok";
  if (env.CLAUDE_CODE || env.CLAUDE_PROJECT_DIR) return "claude";
  if (env.CODEX_HOME) return "codex";
  return "codex";
}

export function detectPlatformFromInput(input: Record<string, unknown>): Platform {
  if ("hook_event_name" in input) return "codex";
  if ("hookEventName" in input) return "claude";
  return "codex";
}

export function resolvePlatform(
  input: Record<string, unknown>,
  explicit?: Platform,
  env: NodeJS.ProcessEnv = process.env,
): Platform {
  if (explicit) return explicit;
  if (env.GROK_HOOK_EVENT || env.GROK_SESSION_ID || env.GROK_HOOK_NAME) return "grok";
  if (env.CLAUDE_CODE || env.CLAUDE_PROJECT_DIR) return "claude";
  if (env.CODEX_HOME) return "codex";
  return detectPlatformFromInput(input);
}