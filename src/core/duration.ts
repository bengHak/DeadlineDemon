export type DeadlineArm = {
  deadlineSec: number;
  task: string;
  hard: boolean;
};

/** Parse a bare minute count (digits only). */
export function parseMinutes(input: string): number | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d+)$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return null;
  return minutes;
}

export function parseDurationSeconds(input: string): number | null {
  const minutes = parseMinutes(input);
  return minutes === null ? null : minutes * 60;
}

export function extractDeadlineArm(input: string): DeadlineArm | null {
  const match = input.match(
    /(?:^|\s)\/?deadline(-hard)?\s+(\d+)(?=\s|["']|$)(?:\s+["']([^"']+)["']|\s+(.+))?/i,
  );
  if (!match) return null;

  const hard = match[1] === "-hard";
  const minutes = parseMinutes(match[2]);
  if (minutes === null) return null;

  const quoted = match[3]?.trim();
  const rest = match[4]?.trim();
  const task = quoted ?? rest ?? "";
  return { deadlineSec: minutes * 60, task, hard };
}

export function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}