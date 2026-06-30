export function detectPlatform(env = process.env) {
    if (env.GROK_HOOK_EVENT || env.GROK_SESSION_ID || env.GROK_HOOK_NAME)
        return "grok";
    if (env.CLAUDE_CODE || env.CLAUDE_PROJECT_DIR)
        return "claude";
    if (env.CODEX_HOME)
        return "codex";
    return "codex";
}
export function detectPlatformFromInput(input) {
    if ("hook_event_name" in input)
        return "codex";
    if ("hookEventName" in input)
        return "claude";
    return "codex";
}
export function resolvePlatform(input, explicit, env = process.env) {
    if (explicit)
        return explicit;
    if (env.GROK_HOOK_EVENT || env.GROK_SESSION_ID || env.GROK_HOOK_NAME)
        return "grok";
    if (env.CLAUDE_CODE || env.CLAUDE_PROJECT_DIR)
        return "claude";
    if (env.CODEX_HOME)
        return "codex";
    return detectPlatformFromInput(input);
}
