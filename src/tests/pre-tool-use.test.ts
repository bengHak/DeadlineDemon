import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { armSession } from "../core/state.js";
import { runPreToolUseHook } from "../hooks/pre-tool-use.js";

describe("pre-tool-use hook", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "deadline-demon-ptu-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("allows when unarmed", () => {
    const result = runPreToolUseHook(
      { hook_event_name: "PreToolUse", session_id: "s1", toolName: "Bash", toolInput: { command: "ls" } },
      { stateDir, platform: "codex" },
    );
    assert.equal(result.deny, false);
  });

  it("allows when armed with time left", () => {
    armSession(stateDir, "s2", 600, "task", 100);
    const result = runPreToolUseHook(
      { hook_event_name: "PreToolUse", session_id: "s2", toolName: "Bash", toolInput: { command: "ls" } },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, false);
  });

  it("allows when soft (nudge) armed and expired", () => {
    armSession(stateDir, "s3-soft", 60, "task", 100, false);
    const result = runPreToolUseHook(
      { hook_event_name: "PreToolUse", session_id: "s3-soft", toolName: "Bash", toolInput: { command: "ls" } },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, false);
  });

  it("denies when hard armed and expired", () => {
    armSession(stateDir, "s3", 60, "task", 100, true);
    const result = runPreToolUseHook(
      { hook_event_name: "PreToolUse", session_id: "s3", toolName: "Bash", toolInput: { command: "ls" } },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, true);
    assert.match(result.output, /deny/i);
  });

  it("allows git commit when hard expired", () => {
    armSession(stateDir, "s4", 60, "task", 100, true);
    const result = runPreToolUseHook(
      {
        hook_event_name: "PreToolUse",
        session_id: "s4",
        toolName: "Bash",
        toolInput: { command: "git commit -m done" },
      },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, false);
  });

  it("denies chained shell commands even when they start with safe git", () => {
    armSession(stateDir, "s4-chain", 60, "task", 100, true);
    const result = runPreToolUseHook(
      {
        hook_event_name: "PreToolUse",
        session_id: "s4-chain",
        toolName: "Bash",
        toolInput: { command: "git status && echo bypass" },
      },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, true);
  });

  it("allows a safe git status command when hard expired", () => {
    armSession(stateDir, "s4-status", 60, "task", 100, true);
    const result = runPreToolUseHook(
      {
        hook_event_name: "PreToolUse",
        session_id: "s4-status",
        toolName: "Bash",
        toolInput: { command: "git status --short" },
      },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, false);
  });

  it("denies extra git commit arguments after the message", () => {
    armSession(stateDir, "s4-commit-extra", 60, "task", 100, true);
    const result = runPreToolUseHook(
      {
        hook_event_name: "PreToolUse",
        session_id: "s4-commit-extra",
        toolName: "Bash",
        toolInput: { command: "git commit -m done --no-verify" },
      },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, true);
  });

  it("emits block decision for claude when hard expired", () => {
    armSession(stateDir, "s5", 60, "task", 100, true);
    const result = runPreToolUseHook(
      {
        hookEventName: "PreToolUse",
        sessionId: "s5",
        toolName: "Bash",
        toolInput: { command: "ls" },
      },
      { stateDir, nowSec: 200, platform: "claude" },
    );
    assert.equal(result.deny, true);
    const parsed = JSON.parse(result.output.trim()) as { decision: string };
    assert.equal(parsed.decision, "block");
  });
});