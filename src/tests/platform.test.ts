import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectPlatform,
  detectPlatformFromInput,
  resolvePlatform,
} from "../formatters/platform.js";
import { formatUserPromptOutput } from "../formatters/output.js";

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