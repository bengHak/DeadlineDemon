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

  it("denies when armed and expired", () => {
    armSession(stateDir, "s3", 60, "task", 100);
    const result = runPreToolUseHook(
      { hook_event_name: "PreToolUse", session_id: "s3", toolName: "Bash", toolInput: { command: "ls" } },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, true);
    assert.match(result.output, /deny/i);
  });

  it("allows git commit when expired", () => {
    armSession(stateDir, "s4", 60, "task", 100);
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
});