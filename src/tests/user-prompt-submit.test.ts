import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { armSession, readSession } from "../core/state.js";
import { runUserPromptSubmitHook } from "../hooks/user-prompt-submit.js";

describe("user-prompt-submit hook", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "deadline-demon-ups-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("arms on /deadline command (nudge-only)", () => {
    const output = runUserPromptSubmitHook(
      { hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "/deadline 8m login" },
      { stateDir, nowSec: 100, platform: "codex" },
    );
    assert.match(output, /Deadline armed/i);
    assert.match(output, /Reminder-only/i);
    assert.match(output, /hookSpecificOutput/);
    const state = readSession(stateDir, "s1");
    assert.equal(state?.hard, false);
  });

  it("arms hard mode on /deadline-hard command", () => {
    const output = runUserPromptSubmitHook(
      { hook_event_name: "UserPromptSubmit", session_id: "s1h", prompt: '/deadline-hard 8m "login"' },
      { stateDir, nowSec: 100, platform: "codex" },
    );
    assert.match(output, /Hard enforcement/i);
    const state = readSession(stateDir, "s1h");
    assert.equal(state?.hard, true);
  });

  it("injects countdown when armed with time left", () => {
    armSession(stateDir, "s2", 600, "task", 100);
    const output = runUserPromptSubmitHook(
      { hook_event_name: "UserPromptSubmit", session_id: "s2", prompt: "continue" },
      { stateDir, nowSec: 300, platform: "codex" },
    );
    assert.match(output, /6m 40s remaining/i);
  });

  it("injects time-up context when expired", () => {
    armSession(stateDir, "s3", 60, "task", 100);
    const output = runUserPromptSubmitHook(
      { hook_event_name: "UserPromptSubmit", session_id: "s3", prompt: "continue" },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.match(output, /TIME'S UP/i);
  });

  it("returns empty when unarmed", () => {
    const output = runUserPromptSubmitHook(
      { hook_event_name: "UserPromptSubmit", session_id: "s4", prompt: "hello" },
      { stateDir, platform: "codex" },
    );
    assert.equal(output, "");
  });

  it("uses grok additionalContext shape", () => {
    armSession(stateDir, "s5", 300, "task", 100);
    const output = runUserPromptSubmitHook(
      { hookEventName: "UserPromptSubmit", sessionId: "s5", prompt: "go" },
      { stateDir, nowSec: 200, platform: "grok" },
    );
    const parsed = JSON.parse(output.trim()) as Record<string, unknown>;
    assert.equal(typeof parsed.additionalContext, "string");
    assert.equal(parsed.hookSpecificOutput, undefined);
  });
});