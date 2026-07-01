import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hookManifestHasPreToolUse,
  installTargets,
  packageRoot,
  persistentCliPath,
  persistentInstallDir,
  uninstallTargets,
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

  it("ships a Grok-valid plugin.json author object", () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot(), "plugin", "plugin.json"), "utf8"),
    ) as { author?: { name?: string; url?: string } };
    assert.equal(typeof manifest.author, "object");
    assert.equal(typeof manifest.author?.name, "string");
    assert.ok((manifest.author?.name?.length ?? 0) > 0);
  });
});

describe("uninstall", () => {
  it("reports persistent dir and three harness targets on dry-run", () => {
    const targets = uninstallTargets(true);
    assert.equal(targets.length, 4);
    assert.equal(targets[0].platform, "persistent");
    assert.deepEqual(
      targets.slice(1).map((t) => t.platform),
      ["grok", "codex", "claude"],
    );
  });
});