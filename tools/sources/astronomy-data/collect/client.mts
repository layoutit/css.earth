import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
export const workDir = resolve(
  process.env.OPUS_WORK_DIR ?? "output/opus-audit",
);
export type Obj = Record<string, unknown>;
export function object(value: unknown): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected object");
  return value as Obj;
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw Error("Expected array");
  return value;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw Error("Expected string");
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw Error("Expected number");
  return value;
}
export function mults(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(object(object(value).mults))) {
    out[k] = number(v);
    if (!Number.isSafeInteger(out[k]) || out[k] < 0)
      throw Error("Invalid count");
  }
  return out;
}
const cache = process.env.OPUS_CACHE ?? workDir + "/cache";
export const api = "https://opus.pds-rings.seti.org/opus/api/";
export async function get(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const url =
    api +
    endpoint +
    (Object.keys(params).length ? "?" + new URLSearchParams(params) : "");
  const key = createHash("sha256").update(url).digest("hex");
  await mkdir(cache, { recursive: true });
  try {
    const saved = object(
      JSON.parse(await readFile(cache + "/" + key + ".json", "utf8")),
    );
    if (saved.url !== url) throw Error("Cache URL mismatch");
    return saved.body;
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
  }
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw Error("HTTP " + r.status + " " + url);
      const body: unknown = await r.json();
      if (object(body).error) throw Error(JSON.stringify(body));
      await writeFile(
        cache + "/" + key + ".json",
        JSON.stringify({ url, retrievedAt: new Date().toISOString(), body }) +
          "\n",
      );
      return body;
    } catch (e) {
      last = e;
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(resolve, 1500 * (attempt + 1)),
        );
    }
  }
  throw last;
}
export async function batch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 3,
): Promise<void> {
  let next = 0;
  const results = await Promise.allSettled(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    }),
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((r) => r.reason),
      "OPUS requests failed",
    );
}
