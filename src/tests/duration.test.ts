import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DEADLINE_MINUTES,
  MAX_TASK_CHARS,
  extractDeadlineArm,
  formatRemaining,
  parseDurationSeconds,
  parseMinutes,
} from "../core/duration.js";

describe("parseMinutes", () => {
  it("parses bare minute counts", () => {
    assert.equal(parseMinutes("8"), 8);
    assert.equal(parseMinutes("  15  "), 15);
  });

  it("rejects units and invalid input", () => {
    assert.equal(parseMinutes("8m"), null);
    assert.equal(parseMinutes("5분"), null);
    assert.equal(parseMinutes("0"), null);
    assert.equal(parseMinutes("not-a-number"), null);
  });

  it("rejects minute counts that cannot become safe seconds", () => {
    const tooLarge = String(Math.floor(Number.MAX_SAFE_INTEGER / 60) + 1);
    assert.equal(parseMinutes(tooLarge), null);
  });

  it("enforces a one-day deadline limit", () => {
    assert.equal(parseMinutes(String(MAX_DEADLINE_MINUTES)), MAX_DEADLINE_MINUTES);
    assert.equal(parseMinutes(String(MAX_DEADLINE_MINUTES + 1)), null);
  });
});

describe("parseDurationSeconds", () => {
  it("converts bare minutes to seconds", () => {
    assert.equal(parseDurationSeconds("8"), 480);
    assert.equal(parseDurationSeconds("5"), 300);
  });

  it("rejects durations that would overflow safe second values", () => {
    const tooLarge = String(Math.floor(Number.MAX_SAFE_INTEGER / 60) + 1);
    assert.equal(parseDurationSeconds(tooLarge), null);
  });
});

describe("extractDeadlineArm", () => {
  it("extracts minutes and quoted task", () => {
    const arm = extractDeadlineArm('/deadline 8 "login page"');
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 480);
    assert.equal(arm.task, "login page");
    assert.equal(arm.hard, false);
  });

  it("extracts unquoted task", () => {
    const arm = extractDeadlineArm("/deadline 5 refactor auth");
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 300);
    assert.equal(arm.task, "refactor auth");
    assert.equal(arm.hard, false);
  });

  it("arms hard mode from Codex no-slash deadline-hard", () => {
    const arm = extractDeadlineArm('deadline-hard 10 "ship it"');
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 600);
    assert.equal(arm.task, "ship it");
    assert.equal(arm.hard, true);
  });

  it("keeps slash-shaped deadline-hard compatible where supported", () => {
    const arm = extractDeadlineArm('/deadline-hard 10 "ship it"');
    assert.ok(arm);
    assert.equal(arm.hard, true);
  });

  it("rejects legacy unit suffixes", () => {
    assert.equal(extractDeadlineArm('/deadline 8m "login"'), null);
    assert.equal(extractDeadlineArm("/deadline 5분 task"), null);
  });

  it("rejects hard deadlines whose seconds would be unsafe", () => {
    const tooLarge = String(Math.floor(Number.MAX_SAFE_INTEGER / 60) + 1);
    assert.equal(extractDeadlineArm(`/deadline-hard ${tooLarge} task`), null);
  });

  it("caps task text so every hook response stays bounded", () => {
    const arm = extractDeadlineArm(`/deadline 5 ${"x".repeat(1200)}`);
    assert.ok(arm);
    assert.equal(arm.task.length, MAX_TASK_CHARS);
    assert.match(arm.task, /\.\.\.$/);
  });
});

describe("formatRemaining", () => {
  it("formats sub-minute and minute values", () => {
    assert.equal(formatRemaining(45), "45s");
    assert.equal(formatRemaining(125), "2m 5s");
  });
});
