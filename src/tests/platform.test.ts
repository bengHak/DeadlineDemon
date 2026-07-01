import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectPlatform,
  detectPlatformFromInput,
  resolvePlatform,
} from "../formatters/platform.js";
import { formatPreToolAllow, formatPreToolDeny, formatUserPromptOutput } from "../formatters/output.js";

describe("resolvePlatform", () => {
  it("prefers explicit override", () => {
    assert.equal(resolvePlatform({}, "grok", {}), "grok");
  });

  it("detects grok from env before input shape", () => {
    assert.equal(
      resolvePlatform({ hook_event_name: "UserPromptSubmit" }, undefined, {
        GROK_HOOK_EVENT: "user_prompt_submit",
      }),
      "grok",
    );
  });

  it("falls back to input shape when env is neutral", () => {
    assert.equal(
      detectPlatformFromInput({ hook_event_name: "UserPromptSubmit" }),
      "codex",
    );
    assert.equal(
      detectPlatformFromInput({ hookEventName: "UserPromptSubmit" }),
      "claude",
    );
  });

  it("detects claude from env", () => {
    assert.equal(detectPlatform({ CLAUDE_PROJECT_DIR: "/repo" }), "claude");
  });
});

describe("grok output format", () => {
  it("emits bare additionalContext for grok", () => {
    const output = formatUserPromptOutput("grok", "<deadline-demon>\nCountdown");
    const parsed = JSON.parse(output.trim()) as Record<string, unknown>;
    assert.equal(typeof parsed.additionalContext, "string");
    assert.equal(parsed.hookSpecificOutput, undefined);
  });
});

describe("pre-tool-use output format", () => {
  it("returns empty stdout for codex allow", () => {
    assert.equal(formatPreToolAllow("codex"), "");
  });

  it("returns allow JSON for grok", () => {
    const parsed = JSON.parse(formatPreToolAllow("grok").trim()) as { decision: string };
    assert.equal(parsed.decision, "allow");
  });

  it("returns block JSON for codex deny", () => {
    const parsed = JSON.parse(formatPreToolDeny("codex", "time up").trim()) as {
      decision: string;
      reason: string;
    };
    assert.equal(parsed.decision, "block");
    assert.equal(parsed.reason, "time up");
  });

  it("returns deny JSON for grok", () => {
    const parsed = JSON.parse(formatPreToolDeny("grok", "time up").trim()) as {
      decision: string;
      reason: string;
    };
    assert.equal(parsed.decision, "deny");
    assert.equal(parsed.reason, "time up");
  });
});