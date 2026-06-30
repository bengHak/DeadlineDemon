import { timeUpDenyReason } from "../core/messages.js";
import { getStateDir, readSession, remainingSeconds } from "../core/state.js";
import { resolveNowSec } from "../core/clock.js";
import { resolvePlatform } from "../formatters/platform.js";
import { formatPreToolAllow, formatPreToolDeny } from "../formatters/output.js";

const SAFE_GIT_PATH = "[A-Za-z0-9._/@:+,=-]+";
const SAFE_GIT_COMMANDS = [
  /^git status(?:\s+(?:--short|-s|--branch|-b|--porcelain(?:=[12])?))*$/,
  new RegExp(`^git diff(?:\\s+(?:--cached|--staged|--stat|--name-only|--name-status|--check|--|${SAFE_GIT_PATH}))*$`),
  new RegExp(`^git add\\s+${SAFE_GIT_PATH}(?:\\s+${SAFE_GIT_PATH})*$`),
  new RegExp(`^git commit\\s+-m\\s+(?:"[^"\\r\\n;&|$<>` + "`" + `]*"|'[^'\\r\\n;&|$<>` + "`" + `]*'|${SAFE_GIT_PATH})$`),
] as const;
const SHELL_CONTROL_CHARS = /[;&|$<>`\r\n]/;

function isWrapUpToolName(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return normalized === "git" || normalized === "run_terminal_command" || normalized === "bash" || normalized === "shell";
}

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
  if (!isWrapUpToolName(toolName)) return false;
  const command =
    typeof toolInput["command"] === "string"
      ? toolInput["command"]
      : typeof toolInput["cmd"] === "string"
        ? toolInput["cmd"]
        : "";
  const normalized = command.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || SHELL_CONTROL_CHARS.test(normalized)) return false;
  return SAFE_GIT_COMMANDS.some((pattern) => pattern.test(normalized));
}

export function runPreToolUseHook(
  input: unknown,
  options?: { stateDir?: string; nowSec?: number; platform?: import("../formatters/platform.js").Platform },
): { output: string; deny: boolean } {
  if (!input || typeof input !== "object") {
    return { output: "", deny: false };
  }

  const record = input as Record<string, unknown>;
  const platform = resolvePlatform(record, options?.platform);
  const stateDir = options?.stateDir ?? getStateDir();
  const sessionId = sessionIdFromInput(record);
  const state = readSession(stateDir, sessionId);

  if (!state?.armed) {
    return { output: formatPreToolAllow(platform), deny: false };
  }

  const remain = remainingSeconds(state, resolveNowSec(options?.nowSec));
  if (remain > 0 || !state.hard) {
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
