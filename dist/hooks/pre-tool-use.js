import { timeUpDenyReason } from "../core/messages.js";
import { getStateDir, readSession, remainingSeconds } from "../core/state.js";
import { resolveNowSec } from "../core/clock.js";
import { resolvePlatform } from "../formatters/platform.js";
import { formatPreToolAllow, formatPreToolDeny } from "../formatters/output.js";
const WRAP_UP_SUBCOMMANDS = new Set(["status", "diff", "add", "commit"]);
const COMMIT_MESSAGE_FLAG = /-(?:m|--message)/i;
const DIFF_NO_INDEX = /(?:^|\s)--no-index(?:=|\s|$)/i;
function isWrapUpToolName(toolName) {
    const normalized = toolName.toLowerCase();
    return normalized === "git" || normalized === "run_terminal_command" || normalized === "bash" || normalized === "shell";
}
function sessionIdFromInput(input) {
    const candidates = [input["session_id"], input["sessionId"], input["GROK_SESSION_ID"]];
    for (const value of candidates) {
        if (typeof value === "string" && value.length > 0)
            return value;
    }
    return "default";
}
function toolNameFromInput(input) {
    if (typeof input["toolName"] === "string")
        return input["toolName"];
    if (typeof input["tool_name"] === "string")
        return input["tool_name"];
    return "";
}
function toolInputFromInput(input) {
    const raw = input["toolInput"] ?? input["tool_input"];
    if (raw && typeof raw === "object")
        return raw;
    return {};
}
function hasLineBreak(command) {
    return command.includes("\r") || command.includes("\n");
}
/** Detect shell chaining/substitution outside balanced quotes. */
export function hasShellInjectionOutsideQuotes(command) {
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
        if (inSingle || inDouble)
            continue;
        if (ch === "#")
            return false;
        if (ch === "\r" || ch === "\n")
            return true;
        if (ch === "&")
            return true;
        if (ch === "|")
            return true;
        if (ch === ";" || ch === "$" || ch === "`" || ch === "<" || ch === ">")
            return true;
    }
    return inSingle || inDouble;
}
/** Block $, backtick, and $( inside commit -m / --message values. */
export function hasCommitSubstitutionMarkers(message) {
    return message.includes("$") || message.includes("`") || message.includes("$(");
}
/** Extract -m / --message argument values from git commit argv tail. */
export function extractCommitMessageValues(commitArgs) {
    const values = [];
    // --message must precede -m so we do not match the "-m" inside "--message".
    const pattern = /(?:--message|-m)(?:\s*=?\s*("[^"]*"|'[^']*'|[^\s-]+))?/gi;
    let match;
    while ((match = pattern.exec(commitArgs)) !== null) {
        const raw = match[1];
        if (!raw)
            continue;
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
            values.push(raw.slice(1, -1));
        }
        else {
            values.push(raw);
        }
    }
    return values;
}
function normalizeGitCommand(toolName, command) {
    const trimmed = command.trim();
    if (trimmed.length === 0)
        return "";
    if (toolName.toLowerCase() === "git" && !/^git\s/i.test(trimmed)) {
        return `git ${trimmed}`;
    }
    return trimmed;
}
/** Allow git status/diff/add/commit wrap-up commands with realistic paths and flags. */
export function isSafeGitWrapUpCommand(command) {
    const trimmed = command.trim();
    if (trimmed.length === 0)
        return false;
    if (hasLineBreak(trimmed))
        return false;
    if (hasShellInjectionOutsideQuotes(trimmed))
        return false;
    const normalized = trimmed.replace(/[ \t\f\v]+/g, " ");
    if (hasShellInjectionOutsideQuotes(normalized))
        return false;
    const match = normalized.match(/^git\s+(\S+)(?:\s+([\s\S]*))?$/i);
    if (!match)
        return false;
    const subcommand = match[1].toLowerCase();
    if (!WRAP_UP_SUBCOMMANDS.has(subcommand))
        return false;
    const args = match[2] ?? "";
    if (subcommand === "diff" && DIFF_NO_INDEX.test(args)) {
        return false;
    }
    if (subcommand === "commit") {
        if (!COMMIT_MESSAGE_FLAG.test(args))
            return false;
        const messages = extractCommitMessageValues(args);
        if (messages.length === 0)
            return false;
        return messages.every((message) => !hasCommitSubstitutionMarkers(message));
    }
    return true;
}
export function isWrapUpTool(toolName, toolInput) {
    if (!isWrapUpToolName(toolName))
        return false;
    const command = typeof toolInput["command"] === "string"
        ? toolInput["command"]
        : typeof toolInput["cmd"] === "string"
            ? toolInput["cmd"]
            : "";
    const gitCommand = normalizeGitCommand(toolName, command);
    return isSafeGitWrapUpCommand(gitCommand);
}
export function runPreToolUseHook(input, options) {
    if (!input || typeof input !== "object") {
        return { output: "", deny: false };
    }
    const record = input;
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
