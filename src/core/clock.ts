export function resolveNowSec(explicit?: number): number | undefined {
  if (explicit !== undefined) return explicit;
  const raw = process.env.DEADLINE_DEMON_NOW_SEC;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}