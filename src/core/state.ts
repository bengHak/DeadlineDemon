import { mkdirSync, readFileSync, unlinkSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SessionState = {
  sessionId: string;
  startedAt: number;
  deadlineSec: number;
  task: string;
  armed: boolean;
};

export function getStateDir(override?: string): string {
  return override ?? join(homedir(), ".deadline-demon", "sessions");
}

function sessionPath(stateDir: string, sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(stateDir, `${safe}.json`);
}

export function readSession(stateDir: string, sessionId: string): SessionState | null {
  const path = sessionPath(stateDir, sessionId);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as SessionState;
    if (typeof parsed.sessionId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(stateDir: string, state: SessionState): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(sessionPath(stateDir, state.sessionId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function deleteSession(stateDir: string, sessionId: string): boolean {
  const path = sessionPath(stateDir, sessionId);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export function armSession(
  stateDir: string,
  sessionId: string,
  deadlineSec: number,
  task: string,
  nowSec = Math.floor(Date.now() / 1000),
): SessionState {
  const state: SessionState = {
    sessionId,
    startedAt: nowSec,
    deadlineSec,
    task,
    armed: true,
  };
  writeSession(stateDir, state);
  return state;
}

export function remainingSeconds(state: SessionState, nowSec = Math.floor(Date.now() / 1000)): number {
  const elapsed = nowSec - state.startedAt;
  return state.deadlineSec - elapsed;
}

export function listSessions(stateDir: string): SessionState[] {
  if (!existsSync(stateDir)) return [];
  return readdirSync(stateDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(stateDir, name), "utf8")) as SessionState;
      } catch {
        return null;
      }
    })
    .filter((s): s is SessionState => s !== null && s.armed);
}