import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractDeadlineArm, formatRemaining, parseDurationSeconds } from "../core/duration.js";

describe("parseDurationSeconds", () => {
  it("parses minutes in English and Korean", () => {
    assert.equal(parseDurationSeconds("8m"), 480);
    assert.equal(parseDurationSeconds("5분"), 300);
    assert.equal(parseDurationSeconds("2 hours"), 7200);
    assert.equal(parseDurationSeconds("90s"), 90);
  });

  it("returns null for invalid input", () => {
    assert.equal(parseDurationSeconds("not-a-duration"), null);
  });
});

describe("extractDeadlineArm", () => {
  it("extracts duration and quoted task from slash command", () => {
    const arm = extractDeadlineArm('/deadline 8m "login page"');
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 480);
    assert.equal(arm.task, "login page");
    assert.equal(arm.hard, false);
  });

  it("extracts Korean duration", () => {
    const arm = extractDeadlineArm("/deadline 5분 refactor auth");
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 300);
    assert.equal(arm.task, "refactor auth");
    assert.equal(arm.hard, false);
  });

  it("arms hard mode from /deadline-hard", () => {
    const arm = extractDeadlineArm('/deadline-hard 10m "ship it"');
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 600);
    assert.equal(arm.task, "ship it");
    assert.equal(arm.hard, true);
  });
});

describe("formatRemaining", () => {
  it("formats sub-minute and minute values", () => {
    assert.equal(formatRemaining(45), "45s");
    assert.equal(formatRemaining(125), "2m 5s");
  });
});