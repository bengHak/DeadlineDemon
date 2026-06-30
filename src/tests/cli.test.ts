import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { installTargets, validateHookManifest } from "../install.js";

describe("install", () => {
  it("reports three harness targets on dry-run", () => {
    const targets = installTargets(true);
    assert.equal(targets.length, 3);
    assert.deepEqual(
      targets.map((t) => t.platform),
      ["grok", "codex", "claude"],
    );
  });

  it("validates plugin hook manifest", () => {
    const path = validateHookManifest();
    assert.match(path, /hooks\.json$/);
  });
});