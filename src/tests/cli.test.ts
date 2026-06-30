import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hookManifestHasPreToolUse,
  installTargets,
  validateHookManifest,
} from "../install.js";

describe("install", () => {
  it("reports three harness targets on dry-run", () => {
    const targets = installTargets(true);
    assert.equal(targets.length, 3);
    assert.deepEqual(
      targets.map((t) => t.platform),
      ["grok", "codex", "claude"],
    );
    assert.equal(targets.every((t) => t.hard === false), true);
  });

  it("marks hard mode on dry-run when requested", () => {
    const targets = installTargets(true, true);
    assert.equal(targets.every((t) => t.hard === true), true);
  });

  it("validates nudge hook manifest without PreToolUse", () => {
    const path = validateHookManifest(false);
    assert.match(path, /hooks\.json$/);
    assert.equal(hookManifestHasPreToolUse(false), false);
  });

  it("validates hard hook manifest with PreToolUse", () => {
    const path = validateHookManifest(true);
    assert.match(path, /hooks-hard\.json$/);
    assert.equal(hookManifestHasPreToolUse(true), true);
  });
});