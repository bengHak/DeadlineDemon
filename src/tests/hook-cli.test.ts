import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { armSession } from "../core/state.js";

const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");

function runHook(
  hookName: "user-prompt-submit" | "pre-tool-use",
  payload: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
  extraArgs: string[] = [],
): { stdout: string; status: number | null } {
  const result = spawnSync(
    process.execPath,
    [cliPath, "hook", hookName, ...extraArgs],
    {
      input: `${JSON.stringify(payload)}\n`,
      encoding: "utf8",
      env,
    },
  );
  return { stdout: result.stdout ?? "", status: result.status };
}

describe("hook CLI piping", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "deadline-demon-cli-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("arms via user-prompt-submit CLI with codex shape", () => {
    const { stdout } = runHook(
      "user-prompt-submit",
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "cli-arm",
        prompt: '/deadline 8m "login"',
      },
      { ...process.env, DEADLINE_DEMON_STATE_DIR: stateDir },
    );
    assert.match(stdout, /hookSpecificOutput/);
    assert.match(stdout, /Deadline armed/i);
  });

  it("emits grok additionalContext shape via --platform and env", () => {
    armSession(stateDir, "cli-grok", 480, "task", 1_000);
    const { stdout } = runHook(
      "user-prompt-submit",
      {
        hookEventName: "UserPromptSubmit",
        sessionId: "cli-grok",
        prompt: "continue",
      },
      {
        ...process.env,
        DEADLINE_DEMON_STATE_DIR: stateDir,
        DEADLINE_DEMON_NOW_SEC: "1100",
        GROK_HOOK_EVENT: "user_prompt_submit",
      },
      ["--platform", "grok"],
    );
    const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
    assert.equal(typeof parsed.additionalContext, "string");
    assert.match(String(parsed.additionalContext), /remaining/i);
    assert.equal(parsed.hookSpecificOutput, undefined);
  });

  it("denies pre-tool-use on expired session with exit code 2", () => {
    armSession(stateDir, "cli-deny", 60, "task", 100);
    const { stdout, status } = runHook(
      "pre-tool-use",
      {
        hook_event_name: "PreToolUse",
        session_id: "cli-deny",
        toolName: "Bash",
        toolInput: { command: "ls" },
      },
      { ...process.env, DEADLINE_DEMON_STATE_DIR: stateDir, DEADLINE_DEMON_NOW_SEC: "200" },
    );
    const parsed = JSON.parse(stdout.trim()) as { decision: string };
    assert.equal(parsed.decision, "deny");
    assert.equal(status, 2);
  });

  it("allows pre-tool-use when time remains with exit code 0", () => {
    armSession(stateDir, "cli-allow", 600, "task", 100);
    const { stdout, status } = runHook(
      "pre-tool-use",
      {
        hook_event_name: "PreToolUse",
        session_id: "cli-allow",
        toolName: "Bash",
        toolInput: { command: "ls" },
      },
      { ...process.env, DEADLINE_DEMON_STATE_DIR: stateDir, DEADLINE_DEMON_NOW_SEC: "200" },
    );
    const parsed = JSON.parse(stdout.trim()) as { decision: string };
    assert.equal(parsed.decision, "allow");
    assert.equal(status, 0);
  });
});