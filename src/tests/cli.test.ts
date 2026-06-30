import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hookManifestHasPreToolUse,
  installTargets,
  persistentCliPath,
  persistentInstallDir,
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
  });

  it("validates hook manifest with UserPromptSubmit and PreToolUse", () => {
    const path = validateHookManifest();
    assert.match(path, /hooks\.json$/);
    assert.equal(hookManifestHasPreToolUse(), true);
  });

  it("uses a persistent home install path for npx-safe hooks", () => {
    assert.match(persistentInstallDir(), /\.deadline-demon$/);
    assert.match(persistentCliPath(), /\/\.deadline-demon\/dist\/cli\.js$/);
  });
});