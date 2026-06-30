import { timeUpDenyReason } from "../core/messages.js";
import { getStateDir, readSession, remainingSeconds } from "../core/state.js";
import { detectPlatform, detectPlatformFromInput } from "../formatters/platform.js";
import { formatPreToolAllow, formatPreToolDeny } from "../formatters/output.js";

const WRAP_UP_TOOLS = /^(git|run_terminal_command|Bash|Shell)$/i;

function sessionIdFromInput(input: Record<string, unknown>): string {
  const candidates = [input["session_id"], input["sessionId"], input["GROK_SESSION_ID"]];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "default";
}

function toolNameFromInput(input: Record<string, unknown>): string {
  if (typeof input["toolName"] === "string") return input["toolName"];
  if (typeof input["tool_name"] === "string") return input["tool_name"];
  return "";
}

function toolInputFromInput(input: Record<string, unknown>): Record<string, unknown> {
  const raw = input["toolInput"] ?? input["tool_input"];
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function isWrapUpTool(toolName: string, toolInput: Record<string, unknown>): boolean {
  if (!WRAP_UP_TOOLS.test(toolName)) return false;
  const command =
    typeof toolInput["command"] === "string"
      ? toolInput["command"]
      : typeof toolInput["cmd"] === "string"
        ? toolInput["cmd"]
        : "";
  return /\bgit\s+(add|commit|status|diff)\b/.test(command);
}

export function runPreToolUseHook(
  input: unknown,
  options?: { stateDir?: string; nowSec?: number; platform?: import("../formatters/platform.js").Platform },
): { output: string; deny: boolean } {
  if (!input || typeof input !== "object") {
    return { output: "", deny: false };
  }

  const record = input as Record<string, unknown>;
  const platform = options?.platform ?? detectPlatformFromInput(record) ?? detectPlatform();
  const stateDir = options?.stateDir ?? getStateDir();
  const sessionId = sessionIdFromInput(record);
  const state = readSession(stateDir, sessionId);

  if (!state?.armed) {
    return { output: formatPreToolAllow(platform), deny: false };
  }

  const remain = remainingSeconds(state, options?.nowSec);
  if (remain > 0) {
    return { output: formatPreToolAllow(platform), deny: false };
  }

  const toolName = toolNameFromInput(record);
  const toolInput = toolInputFromInput(record);
  if (isWrapUpTool(toolName, toolInput)) {
    return { output: formatPreToolAllow(platform), deny: false };
  }

  return {
    output: formatPreToolDeny(platform, timeUpDenyReason(state)),
    deny: true,
  };
}