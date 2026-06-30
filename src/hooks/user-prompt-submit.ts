import { extractDeadlineArm } from "../core/duration.js";
import { armConfirmation, countdownContext, timeUpContext } from "../core/messages.js";
import {
  armSession,
  getStateDir,
  readSession,
  remainingSeconds,
} from "../core/state.js";
import { resolveNowSec } from "../core/clock.js";
import { resolvePlatform } from "../formatters/platform.js";
import { formatUserPromptOutput } from "../formatters/output.js";

function sessionIdFromInput(input: Record<string, unknown>): string {
  const candidates = [
    input["session_id"],
    input["sessionId"],
    input["GROK_SESSION_ID"],
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "default";
}

function promptFromInput(input: Record<string, unknown>): string {
  if (typeof input["prompt"] === "string") return input["prompt"];
  return "";
}

export function runUserPromptSubmitHook(
  input: unknown,
  options?: { stateDir?: string; nowSec?: number; platform?: import("../formatters/platform.js").Platform },
): string {
  if (!input || typeof input !== "object") return "";

  const record = input as Record<string, unknown>;
  const platform = resolvePlatform(record, options?.platform);
  const stateDir = options?.stateDir ?? getStateDir();
  const sessionId = sessionIdFromInput(record);
  const prompt = promptFromInput(record);
  const nowSec = resolveNowSec(options?.nowSec);

  const arm = extractDeadlineArm(prompt);
  if (arm) {
    const state = armSession(stateDir, sessionId, arm.deadlineSec, arm.task, nowSec, arm.hard);
    return formatUserPromptOutput(platform, armConfirmation(state));
  }

  const state = readSession(stateDir, sessionId);
  if (!state?.armed) return "";

  const remain = remainingSeconds(state, nowSec);
  const context = remain <= 0 ? timeUpContext(state) : countdownContext(state, nowSec);
  return formatUserPromptOutput(platform, context);
}