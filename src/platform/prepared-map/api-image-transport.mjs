import { isPreparedWmsImage, readWmsImage } from "./wms-image.mjs";
import { isPreparedWmtsImage } from "./wmts-image.mjs";
import { isPreparedCityAssetUrl } from "./city-asset-url.mjs";
import { readPreparedBytes } from "../prepared-json-transport.mjs";

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

async function untilAborted(promise, signal) {
  let abort;
  try {
    await Promise.race([promise, new Promise((_resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    })]);
  } finally { signal.removeEventListener("abort", abort); }
}

function imageReference(page, plan) {
  if (!page || ![page.width, page.height].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("Invalid prepared image dimensions.");
  const api = isPreparedWmsImage(page) || isPreparedWmtsImage(page);
  const local = page.rasterSource === "prepared-raster@1" && /^[a-f0-9]{64}$/u.test(page.sha256 ?? "") &&
    /^\/scenes\/[a-z][a-z0-9-]*\/[a-z0-9-]+-[a-f0-9]{16}\.webp$/u.test(page.url) && page.url.endsWith(`-${page.sha256.slice(0, 16)}.webp`);
  if (!api && !(local || isPreparedCityAssetUrl(plan, page.url, "page", page.sha256))) throw new Error("Invalid prepared imagery request.");
  const decodedBytes = page.width * page.height * 4;
  const bound = api ? decodedBytes + 65536 : page.bytes;
  if (!Number.isSafeInteger(decodedBytes) || !Number.isSafeInteger(bound) || bound < 1) throw new Error("Invalid prepared image size.");
  return { api, decodedBytes, bound, signature: JSON.stringify([page.width, page.height, api ? page.provider?.emptyImage ?? null : [page.sha256, page.bytes]]) };
}

function expiresAt(headers, now) {
  const control = headers.get("cache-control") ?? "";
  if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(control)) return now;
  const maxAge = control.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i);
  const age = Math.max(0, Number(headers.get("age")) || 0);
  const dateAge = Math.max(0, (now - Date.parse(headers.get("date"))) / 1000) || 0;
  if (maxAge) return now + Math.max(0, Number(maxAge[1]) - Math.max(age, dateAge)) * 1000;
  const expiry = Date.parse(headers.get("expires"));
  return Number.isFinite(expiry) ? Math.max(now, expiry - age * 1000) : now;
}

// One image identity/transport owner for a scene. Scopes preserve each mounted
// layer's limits: active leases cost per CSS piece, idle images cost once.
// Pages and their overview share a scope; scopes can share the same blob.
export function createApiImageTransport({ fetchImage = fetch, createImage = () => new Image(), wait = delay, now = Date.now,
  schedule = setTimeout, unschedule = clearTimeout } = {}) {
  const entries = new Map(), owned = new Set(), scopes = new Set();
  let destroyed = false, timer = null, requests = 0, retries = 0, activeRequests = 0, receivedBytes = 0, sharedAcquisitions = 0;
  function remove(entry) {
    if (!owned.delete(entry)) return;
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
    entry.controller.abort();
    const image = entry.image; entry.image = null;
    try { if (image) image.src = ""; }
    finally { if (entry.url) URL.revokeObjectURL(entry.url); }
  }
  function forget(scope, entry) {
    scope.members.delete(entry); entry.members.delete(scope);
    if (!entry.members.size) remove(entry);
  }
  function clearScope(scope) {
    scope.destroyed = true;
    const failures = [];
    for (const entry of scope.members.keys()) { try { forget(scope, entry); } catch (error) { failures.push(error); } }
    scopes.delete(scope); arm();
    if (failures.length) throw new AggregateError(failures, "Map image cleanup failed.");
  }
  function prune() {
    const time = now();
    for (const scope of scopes) for (const [entry, member] of scope.members) {
      if (!member.refs && (!entry.valid || entry.expiresAt <= time || member.idleUntil <= time)) forget(scope, entry);
    }
  }
  function arm() {
    if (timer !== null) { unschedule(timer); timer = null; }
    if (destroyed) return;
    let deadline = Infinity;
    for (const scope of scopes) for (const [entry, member] of scope.members) if (!member.refs) deadline = Math.min(deadline, entry.expiresAt, member.idleUntil);
    if (deadline < Infinity) timer = schedule(() => { timer = null; prune(); arm(); }, Math.max(0, deadline - now()));
  }
  function totals(scope) {
    let decodedBytes = 0, encodedBytes = 0, idleImages = 0;
    for (const [entry, member] of scope.members) {
      decodedBytes += entry.empty ? 0 : entry.decodedBytes * (member.refs || 1);
      encodedBytes += entry.bytes ?? entry.bound;
      if (!member.refs) idleImages++;
    }
    return { decodedBytes, encodedBytes, idleImages, activeImages: scope.members.size - idleImages, entries: scope.members.size };
  }
  function fit(scope, extraEntries, extraDecoded, extraEncoded, keep) {
    const idle = [...scope.members].filter(([entry, member]) => !member.refs && entry !== keep).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (;;) {
      const value = totals(scope);
      if (value.entries + extraEntries <= scope.maximumEntries && value.decodedBytes + extraDecoded <= scope.maximumDecodedBytes &&
          value.encodedBytes + extraEncoded <= scope.maximumEncodedBytes) return;
      const victim = idle.shift();
      if (!victim) throw new RangeError("Active map images exceed the mounted budget.");
      forget(scope, victim[0]); scope.evictions++;
    }
  }
  function invalidate(entry) {
    entry.valid = false; entry.controller.abort();
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
    prune(); arm();
  }
  async function load(entry, page) {
    for (let attempt = 0; ; attempt++) {
      let retry = false, retryMs = attempt === 0 ? 500 : 1500;
      try {
        requests++; activeRequests++;
        try {
          const signal = AbortSignal.any([entry.controller.signal, AbortSignal.timeout(30000)]);
          const response = await fetchImage(page.url, { credentials: entry.api ? "omit" : "same-origin", signal });
          if (!response.ok) {
            retry = [429, 502, 503, 504].includes(response.status);
            const after = response.headers.get("retry-after");
            if (after) {
              const seconds = Number(after), duration = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(after) - now();
              if (Number.isFinite(duration)) retryMs = Math.max(retryMs, duration);
            }
            await response.body?.cancel();
            throw new Error(`Imagery: HTTP ${response.status}`);
          }
          const blob = entry.api ? await readWmsImage(response, page) : new Blob([await readPreparedBytes(response, page)], { type: "image/webp" });
          signal.throwIfAborted();
          entry.bytes = blob.size; receivedBytes += blob.size;
          entry.expiresAt = entry.api ? expiresAt(response.headers, now()) : Infinity;
          const empty = page.provider?.emptyImage;
          if (empty && blob.size === empty.bytes) {
            const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, "0")).join("");
            signal.throwIfAborted();
            if (digest === empty.sha256) { entry.empty = true; entry.confirmed = true; return null; }
          }
          entry.url = URL.createObjectURL(blob);
          entry.image = createImage(page); entry.image.src = entry.url;
          await untilAborted(entry.image.decode(), signal);
          signal.throwIfAborted();
          if (entry.image.naturalWidth !== page.width || entry.image.naturalHeight !== page.height) throw new Error("Prepared image dimensions drifted.");
          entry.confirmed = true;
          return entry.url;
        } finally { activeRequests--; }
      } catch (error) {
        if (entry.controller.signal.aborted) throw error;
        // Native decode errors require an explicit retry. Do not overwrite a
        // failed decoder/blob with another attempt and strand its ownership.
        if (entry.url) throw error;
        retry ||= error instanceof TypeError || error?.name === "TimeoutError";
        if (!retry || attempt >= 2 || retryMs > 30000) throw error;
        retries++; await wait(retryMs, entry.controller.signal);
      }
    }
  }
  const stats = () => ({ requests, retries, sharedAcquisitions, activeRequests, receivedBytes,
    residentImages: owned.size, nativeImages: [...owned].filter(entry => entry.image).length, residentEncodedBytes: [...owned].reduce((sum, entry) => sum + (entry.bytes ?? 0), 0), scopes: [...scopes].map(scope => ({ ...totals(scope), maximumEntries: scope.maximumEntries, maximumDecodedBytes: scope.maximumDecodedBytes, maximumEncodedBytes: scope.maximumEncodedBytes })) });
  return Object.freeze({
    createScope({ maximumEntries, maximumDecodedBytes, idleMilliseconds = 120000 }) {
      if (destroyed || ![maximumEntries, maximumDecodedBytes].every(n => Number.isSafeInteger(n) && n > 0) || !Number.isSafeInteger(idleMilliseconds) || idleMilliseconds < 0) throw new TypeError("Invalid map image scope.");
      // The encoded envelope follows the existing per-image PNG transfer bound.
      const scope = { members: new Map(), maximumEntries, maximumDecodedBytes,
        maximumEncodedBytes: maximumDecodedBytes + maximumEntries * 65536, hits: 0, misses: 0, evictions: 0, destroyed: false };
      scopes.add(scope);
      return Object.freeze({
        acquire(page, { plan, signal } = {}) {
          if (destroyed || scope.destroyed) throw new Error("Invalid destroyed image scope.");
          signal?.throwIfAborted(); prune();
          const ref = imageReference(page, plan), key = page.url;
          let entry = entries.get(key);
          if (entry && entry.signature !== ref.signature) throw new Error("Prepared image identity drifted.");
          let member = entry && scope.members.get(entry);
          fit(scope, member ? 0 : 1, ((member && !member.refs) || entry?.empty) ? 0 : ref.decodedBytes,
            member ? 0 : entry?.bytes ?? ref.bound, entry);
          if (!entry) {
            scope.misses++;
            entry = { ...ref, key, controller: new AbortController(), url: null, bytes: null, members: new Map(), confirmed: false, valid: true, expiresAt: 0 };
            entries.set(key, entry); owned.add(entry);
            const loading = entry;
            loading.ready = load(loading, page).catch(error => { invalidate(loading); throw error; });
            loading.ready.catch(() => {});
          } else { scope.hits++; sharedAcquisitions++; }
          if (!member) { member = { refs: 0, lastUsed: now(), idleUntil: Infinity }; scope.members.set(entry, member); entry.members.set(scope, member); }
          member.refs++; member.idleUntil = Infinity;
          const resource = entry;
          let released = false, rejectAbort = null;
          const abort = () => { rejectAbort?.(signal.reason); release(); };
          function release() {
            if (released) return;
            released = true; signal?.removeEventListener("abort", abort);
            if (!scope.members.has(resource)) return;
            member.refs--;
            if (!member.refs) {
              if (!resource.valid || !resource.confirmed || resource.expiresAt <= now() || !idleMilliseconds) forget(scope, resource);
              else { member.lastUsed = now(); member.idleUntil = now() + idleMilliseconds; }
            }
            arm();
          }
          const ready = signal ? Promise.race([resource.ready, new Promise((resolve, reject) => { rejectAbort = reject; signal.addEventListener("abort", abort, { once: true }); })]) : resource.ready;
          // A load deadline stops pending work, not a displayed image. The
          // consumer releases the completed lease when it clears its binding.
          ready.then(() => signal?.removeEventListener("abort", abort), () => {}); arm();
          return Object.freeze({ ready, get empty() { return resource.empty === true; }, get bytes() { return resource.bytes ?? 0; },
            invalidate() { invalidate(resource); }, release });
        },
        stats: () => ({ ...stats(), ...totals(scope), hits: scope.hits, misses: scope.misses, evictions: scope.evictions,
          maximumEntries, maximumDecodedBytes, maximumEncodedBytes: scope.maximumEncodedBytes }),
        destroy() { if (!scope.destroyed) clearScope(scope); },
      });
    },
    stats,
    destroy() {
      if (destroyed) return; destroyed = true;
      if (timer !== null) { unschedule(timer); timer = null; }
      const failures = [];
      for (const scope of scopes) { try { clearScope(scope); } catch (error) { failures.push(error); } }
      if (failures.length) throw new AggregateError(failures, "Map image cleanup failed.");
    },
  });
}
