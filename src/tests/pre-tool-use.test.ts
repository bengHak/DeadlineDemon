import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { armSession } from "../core/state.js";
import {
  extractCommitMessageValues,
  hasCommitSubstitutionMarkers,
  hasShellInjectionOutsideQuotes,
  isSafeGitWrapUpCommand,
  isWrapUpTool,
  runPreToolUseHook,
} from "../hooks/pre-tool-use.js";

function hardExpired(
  stateDir: string,
  sessionId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
) {
  armSession(stateDir, sessionId, 60, "task", 100, true);
  return runPreToolUseHook(
    { hook_event_name: "PreToolUse", session_id: sessionId, toolName, toolInput },
    { stateDir, nowSec: 200, platform: "codex" },
  );
}

describe("commit message helpers", () => {
  it("detects substitution markers in message text", () => {
    assert.equal(hasCommitSubstitutionMarkers("pwned $(evil)"), true);
    assert.equal(hasCommitSubstitutionMarkers("fix `whoami`"), true);
    assert.equal(hasCommitSubstitutionMarkers("fix$PATH"), true);
    assert.equal(hasCommitSubstitutionMarkers("fix; ok"), false);
  });

  it("extracts -m and --message values without --message false match", () => {
    assert.deepEqual(extractCommitMessageValues('-m "one"'), ["one"]);
    assert.deepEqual(extractCommitMessageValues('--message "two"'), ["two"]);
    assert.deepEqual(extractCommitMessageValues('--message=three'), ["three"]);
    assert.deepEqual(extractCommitMessageValues('--no-verify -m "ship" --message "alt"'), ["ship", "alt"]);
    assert.deepEqual(extractCommitMessageValues('--message "pwned $(evil)"'), ["pwned $(evil)"]);
  });
});

describe("wrap-up command validation", () => {
  it("allows metacharacters inside quoted commit messages", () => {
    assert.equal(hasShellInjectionOutsideQuotes('git commit -m "fix; ok"'), false);
    assert.equal(isSafeGitWrapUpCommand('git commit -m "fix; ok"'), true);
    assert.equal(isSafeGitWrapUpCommand('git commit --message "fix; ok"'), true);
  });

  it("allows realistic git status, add, and commit variants", () => {
    assert.equal(isSafeGitWrapUpCommand("git status ."), true);
    assert.equal(isSafeGitWrapUpCommand('git add "file name"'), true);
    assert.equal(isSafeGitWrapUpCommand('git commit --no-verify -m "ship"'), true);
    assert.equal(isSafeGitWrapUpCommand("git commit --allow-empty -m msg"), true);
    assert.equal(isSafeGitWrapUpCommand("git commit -m done --no-verify"), true);
  });

  it("normalizes bare git tool subcommands", () => {
    assert.equal(isWrapUpTool("git", { command: "status ." }), true);
    assert.equal(isWrapUpTool("git", { command: 'commit -m "wrap up"' }), true);
    assert.equal(isWrapUpTool("Git", { command: "add ." }), true);
  });

  it("rejects shell chaining outside quotes", () => {
    assert.equal(hasShellInjectionOutsideQuotes("git status && echo bypass"), true);
    assert.equal(isSafeGitWrapUpCommand("git status && echo bypass"), false);
  });

  it("rejects newline command separators before whitespace normalization", () => {
    assert.equal(isSafeGitWrapUpCommand("git status\necho bypass"), false);
    assert.equal(isSafeGitWrapUpCommand("git commit -m done\necho bypass"), false);
  });

  it("rejects non-wrap-up git subcommands", () => {
    assert.equal(isSafeGitWrapUpCommand("git push origin main"), false);
    assert.equal(isSafeGitWrapUpCommand("git commit --amend"), false);
  });

  it("rejects commit messages with shell substitution markers", () => {
    assert.equal(isSafeGitWrapUpCommand('git commit -m "$(curl evil)"'), false);
    assert.equal(isSafeGitWrapUpCommand('git commit --message "pwned $(evil)"'), false);
    assert.equal(isSafeGitWrapUpCommand("git commit -m 'fix `whoami`'"), false);
    assert.equal(isSafeGitWrapUpCommand("git commit --message=fix$PATH"), false);
  });

  it("rejects git diff --no-index", () => {
    assert.equal(isSafeGitWrapUpCommand("git diff --no-index /etc/passwd /dev/null"), false);
    assert.equal(isSafeGitWrapUpCommand("git diff --cached"), true);
  });
});

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

  it("allows when soft (nudge) armed and expired", () => {
    armSession(stateDir, "s3-soft", 60, "task", 100, false);
    const result = runPreToolUseHook(
      { hook_event_name: "PreToolUse", session_id: "s3-soft", toolName: "Bash", toolInput: { command: "ls" } },
      { stateDir, nowSec: 200, platform: "codex" },
    );
    assert.equal(result.deny, false);
  });

  it("denies when hard armed and expired", () => {
    const result = hardExpired(stateDir, "s3", "Bash", { command: "ls" });
    assert.equal(result.deny, true);
    assert.match(result.output, /deny/i);
  });

  it("allows git commit when hard expired", () => {
    const result = hardExpired(stateDir, "s4", "Bash", { command: "git commit -m done" });
    assert.equal(result.deny, false);
  });

  it("allows realistic wrap-up commands when hard expired", () => {
    const cases = [
      { toolName: "Bash", toolInput: { command: "git status ." } },
      { toolName: "Bash", toolInput: { command: 'git add "file name"' } },
      { toolName: "Bash", toolInput: { command: 'git commit --no-verify -m "ship"' } },
      { toolName: "Bash", toolInput: { command: "git commit --allow-empty -m msg" } },
      { toolName: "Bash", toolInput: { command: 'git commit -m "fix; ok"' } },
      { toolName: "Bash", toolInput: { command: 'git commit --message "fix; ok"' } },
      { toolName: "git", toolInput: { command: "status --short" } },
      { toolName: "git", toolInput: { command: 'commit -m "wrap up"' } },
    ];
    for (const [index, payload] of cases.entries()) {
      const result = hardExpired(stateDir, `wrap-${index}`, payload.toolName, payload.toolInput);
      assert.equal(result.deny, false, `expected allow for ${payload.toolInput.command ?? payload.toolInput}`);
    }
  });

  it("denies chained shell commands even when they start with safe git", () => {
    const result = hardExpired(stateDir, "s4-chain", "Bash", { command: "git status && echo bypass" });
    assert.equal(result.deny, true);
  });

  it("denies newline-separated shell commands even when they start with safe git", () => {
    const result = hardExpired(stateDir, "s4-newline", "Bash", { command: "git status\necho bypass" });
    assert.equal(result.deny, true);
  });

  it("denies commit without a message flag", () => {
    const result = hardExpired(stateDir, "s4-commit-no-msg", "Bash", { command: "git commit --amend" });
    assert.equal(result.deny, true);
  });

  it("denies commit substitution and git diff --no-index when hard expired", () => {
    const substitutionM = hardExpired(stateDir, "p1-m", "Bash", {
      command: 'git commit -m "$(echo pwned)"',
    });
    assert.equal(substitutionM.deny, true);

    const substitutionLong = hardExpired(stateDir, "p1-message", "Bash", {
      command: 'git commit --message "pwned $(evil)"',
    });
    assert.equal(substitutionLong.deny, true);

    const noIndex = hardExpired(stateDir, "p2", "Bash", {
      command: "git diff --no-index /etc/passwd /dev/null",
    });
    assert.equal(noIndex.deny, true);
  });

  it("emits block decision for claude when hard expired", () => {
    armSession(stateDir, "s5", 60, "task", 100, true);
    const result = runPreToolUseHook(
      {
        hookEventName: "PreToolUse",
        sessionId: "s5",
        toolName: "Bash",
        toolInput: { command: "ls" },
      },
      { stateDir, nowSec: 200, platform: "claude" },
    );
    assert.equal(result.deny, true);
    const parsed = JSON.parse(result.output.trim()) as { decision: string };
    assert.equal(parsed.decision, "block");
  });
});
