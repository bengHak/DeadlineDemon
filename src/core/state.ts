import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

export type SessionState = {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly deadlineSec: number;
  readonly task: string;
  readonly armed: boolean;
  /** When true, expired sessions deny non-wrap-up tool calls (deadline-hard). */
  readonly hard: boolean;
};

const STATE_DIR_MODE = 0o700;
const STATE_FILE_MODE = 0o600;
const SAFE_SESSION_ID = /^[a-zA-Z0-9._-]{1,128}$/;

export function getStateDir(override?: string): string {
  if (override) return override;
  if (process.env.DEADLINE_DEMON_STATE_DIR) return process.env.DEADLINE_DEMON_STATE_DIR;
  return join(homedir(), ".deadline-demon", "sessions");
}

function sessionPath(stateDir: string, sessionId: string): string {
  if (SAFE_SESSION_ID.test(sessionId)) return join(stateDir, `${sessionId}.json`);
  const digest = createHash("sha256").update(sessionId).digest("hex");
  return join(stateDir, `sha256-${digest}.json`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeSecond(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseSessionState(value: unknown): SessionState | null {
  if (!isRecord(value)) return null;
  const { sessionId, startedAt, deadlineSec, task, armed, hard } = value;
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  if (!isSafeSecond(startedAt) || !isSafeSecond(deadlineSec) || deadlineSec === 0) return null;
  if (typeof task !== "string") return null;
  if (typeof armed !== "boolean") return null;
  const hardMode = typeof hard === "boolean" ? hard : false;
  return { sessionId, startedAt, deadlineSec, task, armed, hard: hardMode };
}

function ensureStateDir(stateDir: string): void {
  mkdirSync(stateDir, { recursive: true, mode: STATE_DIR_MODE });
  chmodSync(stateDir, STATE_DIR_MODE);
}

export function readSession(stateDir: string, sessionId: string): SessionState | null {
  const path = sessionPath(stateDir, sessionId);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const state = parseSessionState(parsed);
    return state?.sessionId === sessionId ? state : null;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
}

export function writeSession(stateDir: string, state: SessionState): void {
  ensureStateDir(stateDir);
  const path = sessionPath(stateDir, state.sessionId);
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: STATE_FILE_MODE });
  renameSync(tempPath, path);
  chmodSync(path, STATE_FILE_MODE);
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
  hard = false,
): SessionState {
  const state: SessionState = {
    sessionId,
    startedAt: nowSec,
    deadlineSec,
    task,
    armed: true,
    hard,
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
        const parsed: unknown = JSON.parse(readFileSync(join(stateDir, name), "utf8"));
        return parseSessionState(parsed);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        return null;
      }
    })
    .filter((s): s is SessionState => s !== null && s.armed);
}
