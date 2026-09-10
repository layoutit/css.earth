import { dirname, basename, resolve } from "node:path";
import { array, object, integer, parseJson } from "./oracle-values.mts";

export interface WindowAudit {
  readonly visibleWindowCount: number;
  readonly frontmostApplication: Readonly<Record<string, unknown> & { pid: number }>;
  readonly windows: readonly Record<string, unknown>[];
}
export function parseWindowAudit(value: unknown): WindowAudit {
  const entry = object(value, "window audit");
  const frontmost = object(entry.frontmostApplication, "frontmost application");
  return { ...entry, visibleWindowCount: integer(entry.visibleWindowCount, "visibleWindowCount"),
    frontmostApplication: { ...frontmost, pid: integer(frontmost.pid, "frontmost pid") },
    windows: array(entry.windows, "audit windows").map(value => object(value, "audit window")),
  };
}
export function parseEventLine(line: string): Record<string, unknown> {
  const value = object(parseJson(line), "native event");
  if (typeof value.event !== "string") throw new TypeError("Native event must name its event kind.");
  return value;
}
/** Native manifest members are stored directly in Contents/MacOS or Contents/Frameworks. */
export function appBundleForMember(member: string): string {
  const path = resolve(member);
  const contents = dirname(dirname(path));
  const app = dirname(contents);
  if (basename(contents) !== "Contents" || !basename(app).endsWith(".app") ||
      !["MacOS", "Frameworks"].includes(basename(dirname(path)))) {
    throw new TypeError(`Not a native application member: ${member}`);
  }
  return app;
}
