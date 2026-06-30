import { timeUpDenyReason } from "../core/messages.js";
import { getStateDir, readSession, remainingSeconds } from "../core/state.js";
import { resolveNowSec } from "../core/clock.js";
import { resolvePlatform } from "../formatters/platform.js";
import { formatPreToolAllow, formatPreToolDeny } from "../formatters/output.js";

const WRAP_UP_SUBCOMMANDS = new Set(["status", "diff", "add", "commit"]);

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

/** Detect shell chaining/substitution outside balanced quotes. */
export function hasShellInjectionOutsideQuotes(command: string): boolean {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;

    if (ch === "#") return false;
    if (ch === "\r" || ch === "\n") return true;
    if (ch === "&") return true;
    if (ch === "|") return true;
    if (ch === ";" || ch === "$" || ch === "`" || ch === "<" || ch === ">") return true;
  }

  return inSingle || inDouble;
}

function normalizeGitCommand(toolName: string, command: string): string {
  const trimmed = command.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return "";
  if (toolName.toLowerCase() === "git" && !/^git\s/i.test(trimmed)) {
    return `git ${trimmed}`;
  }
  return trimmed;
}

/** Allow git status/diff/add/commit wrap-up commands with realistic paths and flags. */
export function isSafeGitWrapUpCommand(command: string): boolean {
  const normalized = command.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return false;
  if (hasShellInjectionOutsideQuotes(normalized)) return false;

  const match = normalized.match(/^git\s+(\S+)(?:\s+([\s\S]*))?$/i);
  if (!match) return false;

  const subcommand = match[1].toLowerCase();
  if (!WRAP_UP_SUBCOMMANDS.has(subcommand)) return false;

  if (subcommand === "commit") {
    return /\s-(?:m|--message)(?:\s|=)/i.test(normalized);
  }

  return true;
}

export function isWrapUpTool(toolName: string, toolInput: Record<string, unknown>): boolean {
  if (!isWrapUpToolName(toolName)) return false;
  const command =
    typeof toolInput["command"] === "string"
      ? toolInput["command"]
      : typeof toolInput["cmd"] === "string"
        ? toolInput["cmd"]
        : "";
  const gitCommand = normalizeGitCommand(toolName, command);
  return isSafeGitWrapUpCommand(gitCommand);
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