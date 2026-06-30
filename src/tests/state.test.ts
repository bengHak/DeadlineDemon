import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  armSession,
  deleteSession,
  listSessions,
  readSession,
  remainingSeconds,
} from "../core/state.js";

describe("session state", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "deadline-demon-state-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("arms, reads, and resets per session", () => {
    const state = armSession(stateDir, "sess-1", 480, "login page", 1_000);
    assert.equal(state.armed, true);
    assert.equal(state.hard, false);
    assert.equal(remainingSeconds(state, 1_100), 380);
    assert.equal(deleteSession(stateDir, "sess-1"), true);
    assert.equal(readSession(stateDir, "sess-1"), null);
  });

  it("persists hard mode when armed", () => {
    armSession(stateDir, "sess-hard", 480, "login page", 1_000, true);
    const state = readSession(stateDir, "sess-hard");
    assert.equal(state?.hard, true);
  });

  it("keeps unsafe session ids isolated instead of collapsing them to the same file", () => {
    armSession(stateDir, "a/b", 60, "first", 1_000, true);
    armSession(stateDir, "a?b", 120, "second", 1_000, false);

    assert.equal(readSession(stateDir, "a/b")?.task, "first");
    assert.equal(readSession(stateDir, "a?b")?.task, "second");
  });

  it("writes private state files", () => {
    armSession(stateDir, "sess-private", 480, "login page", 1_000);
    assert.equal(statSync(stateDir).mode & 0o777, 0o700);
    assert.equal(statSync(join(stateDir, "sess-private.json")).mode & 0o777, 0o600);
  });

  it("ignores malformed session state", () => {
    writeFileSync(
      join(stateDir, "bad.json"),
      JSON.stringify({ sessionId: "bad", startedAt: "1000", deadlineSec: 480, task: "x", armed: true }),
      "utf8",
    );
    assert.equal(readSession(stateDir, "bad"), null);
    assert.deepEqual(listSessions(stateDir), []);
  });

  it("defaults hard to false for legacy session files", () => {
    writeFileSync(
      join(stateDir, "legacy.json"),
      JSON.stringify({ sessionId: "legacy", startedAt: 1000, deadlineSec: 480, task: "x", armed: true }),
      "utf8",
    );
    const state = readSession(stateDir, "legacy");
    assert.equal(state?.hard, false);
  });
});
