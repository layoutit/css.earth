export function requireEarthSurfacePages(urls, label = "Earth surface") {
  if (!Array.isArray(urls) || urls.length === 0 ||
      urls.some((url) => typeof url !== "string" || !url.startsWith("/scenes/earth/")) ||
      new Set(urls).size !== urls.length) {
    throw new TypeError(`${label} requires unique prepared page URLs.`);
  }
  return Object.freeze([...urls]);
}

export function publishEarthSurfacePages(carriers, urls, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1 || !Array.isArray(urls) ||
      urls.length !== 0 && urls.length !== pageCount) {
    throw new TypeError("Earth surface publication requires a complete page bank.");
  }
  if (urls.length) requireEarthSurfacePages(urls);
  for (const carrier of carriers) for (let index = 0; index < pageCount; index++) {
    carrier.style.setProperty(`--earth-surface-page-${index}`,
      urls.length ? `url("${urls[index]}")` : "none");
  }
}

// Only the visible bank and the latest requested bank own image-store entries.
// At most two owned pages decode at once. Clearing src retires native work, but
// Chrome may never settle that old promise, so it cannot keep a logical slot.
export function createEarthSurfaceImageBanks({ imageStore, banks }) {
  if (typeof imageStore?.load !== "function" || typeof imageStore?.release !== "function" ||
      !Array.isArray(banks) || banks.length === 0) {
    throw new TypeError("Earth surface banks require a prepared image store and bank inventory.");
  }
  const inventory = new Map();
  const owners = new Map();
  for (const { id, urls } of banks) {
    if (typeof id !== "string" || !id || inventory.has(id)) {
      throw new TypeError("Earth surface bank identity is invalid.");
    }
    const pages = requireEarthSurfacePages(urls, id);
    for (const url of pages) {
      if (owners.has(url)) throw new TypeError("Earth surface banks must own distinct page URLs.");
      owners.set(url, id);
    }
    inventory.set(id, pages);
  }
  const tickets = new WeakMap();
  let active = null, pending = null, currentTicket = null;
  let inFlight = 0, destroyed = false;

  function releaseEntry(entry) {
    if (!entry || entry.retired) return [];
    entry.retired = true;
    const errors = [];
    for (const url of entry.started) {
      try { imageStore.release(url); } catch (error) { errors.push(error); }
    }
    entry.started.clear();
    for (const job of [...entry.jobs]) finish(job);
    return errors;
  }

  function cancelEntry(entry) {
    const errors = releaseEntry(entry);
    entry?.resolve(null);
    if (errors.length) throw new AggregateError(errors, "Earth surface bank release failed.");
  }

  function failEntry(entry, error) {
    if (entry.retired) return;
    if (pending === entry) pending = null;
    const errors = releaseEntry(entry);
    entry.reject(errors.length
      ? new AggregateError([error, ...errors], error.message, { cause: error })
      : error);
  }

  function pump() {
    const entry = pending;
    if (destroyed || !entry || entry.retired) return;
    while (inFlight < 2 && entry.next < entry.urls.length) {
      const url = entry.urls[entry.next++];
      entry.started.add(url);
      const job = { entry, finished: false };
      entry.jobs.add(job);
      inFlight++;
      Promise.resolve().then(() => entry.retired ? null : imageStore.load(url)).then(
        (image) => {
          if (entry.retired) return;
          if (!image) throw new Error(`Earth surface page was retired before decoding: ${url}.`);
          entry.loaded++;
          if (entry.loaded === entry.urls.length) {
            entry.ready = true;
            entry.resolve(entry);
          }
        },
      ).catch((error) => failEntry(entry, error)).finally(() => finish(job));
    }
  }

  function finish(job) {
    if (job.finished) return;
    job.finished = true;
    job.entry.jobs.delete(job);
    inFlight--;
    pump();
  }

  function request(id) {
    if (destroyed) throw new Error("Earth surface banks are destroyed.");
    const urls = inventory.get(id);
    if (!urls) throw new RangeError(`Unknown Earth surface bank: ${id}.`);
    if (pending && pending.id !== id) {
      const previous = pending;
      pending = null;
      cancelEntry(previous);
    }
    let entry = active?.id === id ? active : pending;
    if (!entry) {
      entry = { id, urls, started: new Set(), jobs: new Set(), next: 0, loaded: 0, ready: false, retired: false };
      entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
      // A newer selection may skip the old prepare callback before it observes
      // this promise. Observe rejection here without changing caller failures.
      entry.promise.catch(() => {});
      pending = entry;
    }
    const ticket = Object.freeze({ id, urls, ready: entry.promise });
    tickets.set(ticket, entry);
    currentTicket = ticket;
    pump();
    return ticket;
  }

  function commit(ticket) {
    const entry = tickets.get(ticket);
    if (destroyed || currentTicket !== ticket || !entry || entry.retired || !entry.ready ||
        entry !== active && entry !== pending) {
      throw new Error("Earth surface bank publication is stale or unprepared.");
    }
    const previous = active;
    active = entry;
    pending = null;
    if (previous && previous !== entry) cancelEntry(previous);
  }

  function discard(ticket) {
    const entry = tickets.get(ticket);
    if (currentTicket !== ticket || !entry || entry === active) return;
    currentTicket = null;
    if (pending === entry) pending = null;
    cancelEntry(entry);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    currentTicket = null;
    const entries = new Set([active, pending]);
    active = null;
    pending = null;
    const errors = [];
    for (const entry of entries) {
      try { cancelEntry(entry); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Earth surface banks cleanup failed.");
  }

  return Object.freeze({
    request, commit, discard, destroy,
    stats: () => Object.freeze({
      activeId: active?.id ?? null,
      pendingId: pending?.id ?? null,
      retainedBankCount: Number(Boolean(active)) + Number(Boolean(pending)),
      inFlightPageCount: inFlight,
      queuedPageCount: pending ? pending.urls.length - pending.next : 0,
    }),
  });
}
