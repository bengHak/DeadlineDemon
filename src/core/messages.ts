import { formatRemaining } from "./duration.js";
import type { SessionState } from "./state.js";
import { remainingSeconds } from "./state.js";

const MARKER = "<deadline-demon>";

export function countdownContext(state: SessionState, nowSec?: number): string {
  const remain = remainingSeconds(state, nowSec);
  const taskLine = state.task ? `Task: ${state.task}\n` : "";
  const urgency =
    remain <= 30
      ? "FINAL SECONDS — stop new work, summarize, commit if applicable, reply DONE."
      : remain <= 120
        ? "WRAP-UP MODE — no new exploration; finish what is in flight."
        : "Stay focused; avoid unnecessary tool calls.";

  return `${MARKER}
🔥 DeadlineDemon: ${formatRemaining(remain)} remaining.
${taskLine}${urgency}`;
}

export function timeUpContext(state: SessionState): string {
  const taskLine = state.task ? `Task was: ${state.task}\n` : "";
  return `${MARKER}
⏰ TIME'S UP. Stop all new work immediately.
${taskLine}Summarize what you completed, commit if applicable, and reply DONE.`;
}

export function armConfirmation(state: SessionState): string {
  const taskLine = state.task ? ` for "${state.task}"` : "";
  const modeLine = state.hard
    ? "Hard enforcement is active — tool calls will be blocked after time runs out."
    : "Reminder-only — countdown nudges each turn; tool calls are not blocked.";
  return `${MARKER}
⏱️ Deadline armed: ${formatRemaining(state.deadlineSec)}${taskLine}. ${modeLine}`;
}

export function timeUpDenyReason(state: SessionState): string {
  return `DeadlineDemon: session deadline expired. ${state.task ? `Task: ${state.task}. ` : ""}Summarize, commit if applicable, and stop. No further tool calls.`;
}

export function hasMarker(text: string): boolean {
  return text.includes(MARKER);
}