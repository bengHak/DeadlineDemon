export function formatUserPromptOutput(platform, additionalContext) {
    const normalized = additionalContext.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (normalized.length === 0)
        return "";
    if (platform === "grok") {
        return `${JSON.stringify({ additionalContext: normalized })}\n`;
    }
    return `${JSON.stringify({
        hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: normalized,
        },
    })}\n`;
}
export function formatPreToolDeny(platform, reason) {
    if (platform === "grok") {
        return `${JSON.stringify({ decision: "deny", reason })}\n`;
    }
    return `${JSON.stringify({ decision: "block", reason })}\n`;
}
export function formatPreToolAllow(platform) {
    if (platform === "grok") {
        return `${JSON.stringify({ decision: "allow" })}\n`;
    }
    return "";
}
