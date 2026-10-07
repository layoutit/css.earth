/** Requests to MAST, the archive the missions' light curves are read from.
 *
 * Requests go PACE_MS apart and a 429 is waited out. The archive does answer requests sent side by side (measured
 * 2026-10-06: eight light-curve files at once, eight position queries at once, none refused), so a star's files are
 * fetched together and several runs may share the stars (reduce.mts --shard).
 * Every request is public and anonymous, and names this tool and nothing else. */
export const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';
/** The pause between two requests, and the wait after the archive asks for one. */
export const PACE_MS = 400, BACK_OFF_MS = 30_000;

let last = 0;
/** One request to MAST, after the pace and through every 429. */
export async function paced(url: string, init: RequestInit = {}): Promise<Response> {
  for (;;) { const wait = last + PACE_MS - Date.now(); if (wait > 0) await new Promise(done => setTimeout(done, wait));
    const response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers as Record<string, string> | undefined }, redirect: 'follow', signal: AbortSignal.timeout(600_000) }); last = Date.now();
    if (response.status !== 429) return response;
    await new Promise(done => setTimeout(done, BACK_OFF_MS)); }
}
