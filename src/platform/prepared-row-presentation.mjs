// Select existing prepared addresses only. Resource scheduling, capacity and
// the last published row's protection belong to the shared residency owner.
export function preparedRowPresentation(plan, frameIndex, resources, prefix, fallback = "same-column") {
  if (!["same-column", "nearest-frame"].includes(fallback)) throw new TypeError("Unknown prepared row fallback policy.");
  const target = Number.isSafeInteger(frameIndex) && plan.presentations[frameIndex];
  if (!target) throw new RangeError(`Unprepared material frame: ${frameIndex}.`);
  let row = target.rowIndex;
  if (!resources.has(`${prefix}${row}`)) {
    let nearest = null, distance = Infinity;
    for (const key of resources.readyKeys()) {
      if (!key.startsWith(prefix)) continue;
      const candidate = Number(key.slice(prefix.length));
      if (!plan.rows[candidate]) continue;
      const delta = Math.abs(candidate - row);
      if (delta < distance) { nearest = candidate; distance = delta; }
    }
    if (nearest === null) return null;
    row = nearest;
  }
  const count = plan.transport.framesPerRow ?? 1;
  const first = row * count;
  const selected = fallback === "nearest-frame"
    ? Math.max(first, Math.min(plan.presentations.length - 1, first + count - 1, frameIndex))
    : Math.min(plan.presentations.length - 1, first + frameIndex % count);
  const prepared = plan.presentations[selected];
  return Object.freeze({ ...prepared, url: resources.url(`${prefix}${row}`) });
}
