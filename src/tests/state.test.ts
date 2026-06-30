import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  armSession,
  deleteSession,
  readSession,
  remainingSeconds,
} from "../core/state.js";

describe("session state", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "deadline-demon-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("arms, reads, and resets per session", () => {
    const state = armSession(stateDir, "sess-1", 480, "login page", 1_000);
    assert.equal(state.armed, true);
    assert.deepEqual(readSession(stateDir, "sess-1"), state);
    assert.equal(remainingSeconds(state, 1_100), 380);
    assert.equal(deleteSession(stateDir, "sess-1"), true);
    assert.equal(readSession(stateDir, "sess-1"), null);
  });
});