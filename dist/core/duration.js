export const MAX_DEADLINE_MINUTES = 24 * 60;
export const MAX_TASK_CHARS = 200;
const TASK_TRUNCATION_MARKER = "...";
function normalizeTask(input) {
    const collapsed = input.replace(/\s+/g, " ").trim();
    if (collapsed.length <= MAX_TASK_CHARS)
        return collapsed;
    return `${collapsed.slice(0, MAX_TASK_CHARS - TASK_TRUNCATION_MARKER.length)}${TASK_TRUNCATION_MARKER}`;
}
/** Parse a bare minute count (digits only). */
export function parseMinutes(input) {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d+)$/);
    if (!match)
        return null;
    const minutes = Number(match[1]);
    if (!Number.isSafeInteger(minutes) || minutes <= 0)
        return null;
    if (minutes > MAX_DEADLINE_MINUTES)
        return null;
    return minutes;
}
export function parseDurationSeconds(input) {
    const minutes = parseMinutes(input);
    if (minutes === null)
        return null;
    const seconds = minutes * 60;
    return Number.isSafeInteger(seconds) ? seconds : null;
}
export function extractDeadlineArm(input) {
    const match = input.match(/(?:^|\s)\/?deadline(-hard)?\s+(\d+)(?=\s|["']|$)(?:\s+["']([^"']+)["']|\s+(.+))?/i);
    if (!match)
        return null;
    const hard = match[1] === "-hard";
    const minutes = parseMinutes(match[2]);
    if (minutes === null)
        return null;
    const quoted = match[3]?.trim();
    const rest = match[4]?.trim();
    const deadlineSec = parseDurationSeconds(match[2]);
    if (deadlineSec === null)
        return null;
    const task = normalizeTask(quoted ?? rest ?? "");
    return { deadlineSec, task, hard };
}
export function formatRemaining(seconds) {
    const clamped = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const secs = clamped % 60;
    if (hours > 0)
        return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0)
        return `${minutes}m ${secs}s`;
    return `${secs}s`;
}
