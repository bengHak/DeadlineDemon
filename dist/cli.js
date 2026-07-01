#!/usr/bin/env node
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { runPreToolUseHook } from "./hooks/pre-tool-use.js";
import { runUserPromptSubmitHook } from "./hooks/user-prompt-submit.js";
import { deleteSession, getStateDir, listSessions, readSession, remainingSeconds, } from "./core/state.js";
import { resolveNowSec } from "./core/clock.js";
import { formatRemaining } from "./core/duration.js";
import { installTargets, uninstallTargets, validateHookManifest } from "./install.js";
const MAX_HOOK_PAYLOAD_BYTES = 1_048_576;
function parseHookArgs(args) {
    const hookName = args[1];
    const platformIdx = args.indexOf("--platform");
    const platform = platformIdx >= 0 ? args[platformIdx + 1] : undefined;
    if (platform && platform !== "codex" && platform !== "claude" && platform !== "grok") {
        throw new Error(`Invalid --platform: ${platform}`);
    }
    return { hookName, platform };
}
async function readStdin() {
    const chunks = [];
    let bytesRead = 0;
    for await (const chunk of processStdin) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytesRead += buffer.byteLength;
        if (bytesRead > MAX_HOOK_PAYLOAD_BYTES) {
            throw new Error(`Hook payload exceeds ${MAX_HOOK_PAYLOAD_BYTES} bytes`);
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks, bytesRead).toString("utf8");
}
function printStatus(sessionId) {
    const stateDir = getStateDir();
    const nowSec = resolveNowSec();
    if (sessionId) {
        const state = readSession(stateDir, sessionId);
        if (!state?.armed) {
            processStdout.write(`No armed deadline for session ${sessionId}\n`);
            return;
        }
        const remain = remainingSeconds(state, nowSec);
        processStdout.write(`session=${state.sessionId} armed=true mode=${state.hard ? "hard" : "nudge"} remain=${formatRemaining(remain)} task=${state.task || "(none)"}\n`);
        return;
    }
    const sessions = listSessions(stateDir);
    if (sessions.length === 0) {
        processStdout.write("No armed deadlines\n");
        return;
    }
    for (const state of sessions) {
        const remain = remainingSeconds(state, nowSec);
        processStdout.write(`session=${state.sessionId} mode=${state.hard ? "hard" : "nudge"} remain=${formatRemaining(remain)} task=${state.task || "(none)"}\n`);
    }
}
function printReset(sessionId) {
    const stateDir = getStateDir();
    if (sessionId) {
        const removed = deleteSession(stateDir, sessionId);
        processStdout.write(removed ? `Reset session ${sessionId}\n` : `No state for session ${sessionId}\n`);
        return;
    }
    const sessions = listSessions(stateDir);
    if (sessions.length === 0) {
        processStdout.write("No sessions to reset\n");
        return;
    }
    for (const state of sessions) {
        deleteSession(stateDir, state.sessionId);
    }
    processStdout.write(`Reset ${sessions.length} session(s)\n`);
}
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    if (command === "hook") {
        const { hookName, platform } = parseHookArgs(args);
        const payload = await readStdin();
        const input = payload.trim().length > 0 ? JSON.parse(payload) : {};
        const hookOptions = platform ? { platform } : undefined;
        if (hookName === "user-prompt-submit") {
            processStdout.write(runUserPromptSubmitHook(input, hookOptions));
            return;
        }
        if (hookName === "pre-tool-use") {
            const result = runPreToolUseHook(input, hookOptions);
            processStdout.write(result.output);
            process.exit(result.deny ? 2 : 0);
        }
        throw new Error(`Unknown hook: ${hookName ?? "(missing)"}`);
    }
    if (command === "install") {
        const dryRun = args.includes("--dry-run");
        const targets = installTargets(dryRun);
        processStdout.write("install: UserPromptSubmit + PreToolUse (use deadline or deadline-hard in Codex; slash form where supported)\n");
        for (const target of targets) {
            processStdout.write(`${target.platform}: ${target.path} (${target.action})${dryRun ? " [dry-run]" : ""}\n`);
        }
        if (!dryRun) {
            processStdout.write(`manifest: ${validateHookManifest()}\n`);
        }
        return;
    }
    if (command === "uninstall") {
        const dryRun = args.includes("--dry-run");
        const targets = uninstallTargets(dryRun);
        processStdout.write("uninstall: remove hooks and persistent install\n");
        for (const target of targets) {
            processStdout.write(`${target.platform}: ${target.path} (${target.action})${dryRun ? " [dry-run]" : ""}\n`);
        }
        return;
    }
    if (command === "status") {
        const sessionIdx = args.indexOf("--session-id");
        printStatus(sessionIdx >= 0 ? args[sessionIdx + 1] : undefined);
        return;
    }
    if (command === "reset") {
        const sessionIdx = args.indexOf("--session-id");
        printReset(sessionIdx >= 0 ? args[sessionIdx + 1] : undefined);
        return;
    }
    processStdout.write(`Usage:
  deadline-demon install [--dry-run]
  deadline-demon uninstall [--dry-run]
  deadline-demon status [--session-id <id>]
  deadline-demon reset [--session-id <id>]
  deadline-demon hook user-prompt-submit [--platform codex|claude|grok]
  deadline-demon hook pre-tool-use [--platform codex|claude|grok]
`);
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
});
