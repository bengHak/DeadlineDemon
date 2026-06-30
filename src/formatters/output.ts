import type { Platform } from "./platform.js";

export function formatUserPromptOutput(platform: Platform, additionalContext: string): string {
  const normalized = additionalContext.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (normalized.length === 0) return "";

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

export function formatPreToolDeny(platform: Platform, reason: string): string {
  if (platform === "grok") {
    return `${JSON.stringify({ decision: "deny", reason })}\n`;
  }
  if (platform === "claude") {
    return `${JSON.stringify({ decision: "block", reason })}\n`;
  }
  return `${JSON.stringify({ decision: "deny", reason })}\n`;
}

export function formatPreToolAllow(platform: Platform): string {
  if (platform === "grok" || platform === "codex") {
    return `${JSON.stringify({ decision: "allow" })}\n`;
  }
  return "";
}