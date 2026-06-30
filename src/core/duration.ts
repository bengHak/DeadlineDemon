const DEADLINE_COMMAND =
  /(?:^|\s)\/?deadline(?:-hard)?\s+(?:(\d+)\s*(?:분|分钟|min(?:ute)?s?|m)|(\d+)\s*(?:초|秒|sec(?:ond)?s?|s)|(\d+)\s*(?:시간|小时|hour?s?|h))(?=\s|$)/i;

export function parseDurationSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const commandMatch = DEADLINE_COMMAND.exec(trimmed);
  if (commandMatch) {
    const minutes = commandMatch[1];
    const seconds = commandMatch[2];
    const hours = commandMatch[3];
    if (minutes) return Number(minutes) * 60;
    if (seconds) return Number(seconds);
    if (hours) return Number(hours) * 3600;
  }

  const bare = trimmed.match(
    /^(\d+)\s*(?:분|分钟|min(?:ute)?s?|m|시간|小时|hour?s?|h|초|秒|sec(?:ond)?s?|s)$/i,
  );
  if (!bare) return null;

  const value = Number(bare[1]);
  const unit = bare[0].slice(String(value).length).trim().toLowerCase();
  if (/^(분|分钟|min|mins|minute|minutes|m)$/.test(unit)) return value * 60;
  if (/^(시간|小时|hour|hours|h)$/.test(unit)) return value * 3600;
  return value;
}

export type DeadlineArm = {
  deadlineSec: number;
  task: string;
  hard: boolean;
};

export function extractDeadlineArm(input: string): DeadlineArm | null {
  const match = input.match(
    /(?:^|\s)\/?deadline(-hard)?\s+(\d+\s*(?:분|分钟|min(?:ute)?s?|m|시간|小时|hour?s?|h|초|秒|sec(?:ond)?s?|s))(?:\s+["']([^"']+)["']|\s+(.+))?/i,
  );
  if (!match) return null;

  const hard = match[1] === "-hard";
  const deadlineSec = parseDurationSeconds(match[2]);
  if (deadlineSec === null || deadlineSec <= 0) return null;

  const quoted = match[3]?.trim();
  const rest = match[4]?.trim();
  const task = quoted ?? rest ?? "";
  return { deadlineSec, task, hard };
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