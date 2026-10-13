export const LOCKED_ROUTES = [
  "/audit",
  "/processing-logs",
  "/system-logic",
  "/data-dictionary",
  "/settings",
  "/accounts",
  "/debug/integrity",
] as const;

export function isLockedPath(path: string): boolean {
  return LOCKED_ROUTES.some((p) => path === p || path.startsWith(p + "/"));
}