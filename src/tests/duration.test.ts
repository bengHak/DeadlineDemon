import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractDeadlineArm, formatRemaining, parseDurationSeconds, parseMinutes } from "../core/duration.js";

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
});

describe("parseDurationSeconds", () => {
  it("converts bare minutes to seconds", () => {
    assert.equal(parseDurationSeconds("8"), 480);
    assert.equal(parseDurationSeconds("5"), 300);
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

  it("arms hard mode from /deadline-hard", () => {
    const arm = extractDeadlineArm('/deadline-hard 10 "ship it"');
    assert.ok(arm);
    assert.equal(arm.deadlineSec, 600);
    assert.equal(arm.task, "ship it");
    assert.equal(arm.hard, true);
  });

  it("rejects legacy unit suffixes", () => {
    assert.equal(extractDeadlineArm('/deadline 8m "login"'), null);
    assert.equal(extractDeadlineArm("/deadline 5분 task"), null);
  });
});

describe("formatRemaining", () => {
  it("formats sub-minute and minute values", () => {
    assert.equal(formatRemaining(45), "45s");
    assert.equal(formatRemaining(125), "2m 5s");
  });
});