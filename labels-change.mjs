// src/platform/surface-feature-banks.mts
function surfaceFeatureBankIndex(id, bankCount) {
  if (!/^[0-9]+$/u.test(id) || !Number.isSafeInteger(bankCount) || bankCount < 1 || bankCount > 256) {
    throw new TypeError("Surface feature bank address is invalid.");
  }
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % bankCount;
}

// src/renderers/css/prepared-data/physical-projection.ts
function requirePhysicalProjection(value) {
  if (!(value.focalPixels > 0) || !Number.isFinite(value.focalPixels) || value.principalOffsetPixels.length !== 2 || !value.principalOffsetPixels.every(Number.isFinite) || value.eyeFromScene.length !== 16 || !value.eyeFromScene.every(Number.isFinite)) {
    throw new TypeError("Physical projection requires a finite eye transform and positive focal length.");
  }
  return value;
}

// src/renderers/css/navigation/screen-picking.ts
var registries = /* @__PURE__ */ new WeakMap();
function createRegistry() {
  const publications = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  return {
    publish(owner, targets) {
      publications.set(owner, targets);
      for (const listener of listeners) listener();
    },
    remove(owner) {
      if (publications.delete(owner)) for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pick(x, y) {
      let direct = null;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.shape.kind === "segments") continue;
        if (target.element.ariaDisabled === "true") continue;
        if (direct && direct.rank > target.rank) continue;
        if (!hitsScreenShape(target.shape, x, y)) continue;
        direct = target;
      }
      if (direct) return direct.element;
      let orbit = null;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.shape.kind !== "segments" || target.element.ariaDisabled === "true" || orbit && orbit.rank > target.rank) continue;
        if (hitsScreenShape(target.shape, x, y)) orbit = target;
      }
      return orbit?.element ?? null;
    }
  };
}
function screenPicking(host) {
  let registry = registries.get(host);
  if (!registry) {
    registry = createRegistry();
    registries.set(host, registry);
  }
  return registry;
}
function hitsScreenShape(shape, x, y) {
  if (shape.kind === "rect") return x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom;
  if (shape.kind === "circle") return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
  const bounds = shape.bounds;
  if (bounds === null || bounds && (x < bounds.left - shape.halfWidth || x > bounds.right + shape.halfWidth || y < bounds.top - shape.halfWidth || y > bounds.bottom + shape.halfWidth)) return false;
  for (const [x0, y0, x1, y1, opacity] of shape.segments) {
    if (opacity <= 0.1 || x < Math.min(x0, x1) - shape.halfWidth || x > Math.max(x0, x1) + shape.halfWidth || y < Math.min(y0, y1) - shape.halfWidth || y > Math.max(y0, y1) + shape.halfWidth) continue;
    const dx = x1 - x0, dy = y1 - y0, lengthSquared = dx * dx + dy * dy;
    const along = ((x - x0) * dx + (y - y0) * dy) / lengthSquared;
    if (along < 0 || along > 1 || lengthSquared === 0) continue;
    const cross = (x - x0) * dy - (y - y0) * dx;
    if (cross * cross <= shape.halfWidth ** 2 * lengthSquared) return true;
  }
  return false;
}

// src/renderers/css/solar-system/orbit-segment-presentation.ts
function orbitSegmentTransform([x0, y0, x1, y1]) {
  const dx = x1 - x0, dy = y1 - y0, length = Math.hypot(dx, dy);
  return `matrix(${formatLineNumber(dx)}, ${formatLineNumber(dy)}, ${formatLineNumber(-dy / length)}, ${formatLineNumber(dx / length)}, ${formatLineNumber(x0)}, ${formatLineNumber(y0)})`;
}
function formatLineNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : value.toFixed(6);
}

// src/renderers/css/stars/opacity-clock.ts
var shared = /* @__PURE__ */ new WeakMap();
function createOpacityClock(window) {
  const entry = shared.get(window) ?? { clock: createFrameClock(window), owners: 0 };
  entry.owners++;
  shared.set(window, entry);
  let released = false;
  return Object.freeze({ ...entry.clock, destroy() {
    if (released) return;
    released = true;
    if (--entry.owners > 0) return;
    shared.delete(window);
    entry.clock.destroy();
  } });
}
function createFrameClock(window) {
  const lanes = { input: /* @__PURE__ */ new Map(), present: /* @__PURE__ */ new Map() };
  const callbacks = { get size() {
    return lanes.input.size + lanes.present.size;
  }, clear() {
    lanes.input.clear();
    lanes.present.clear();
  } };
  const dirty = /* @__PURE__ */ new Set(), active = /* @__PURE__ */ new Set();
  let next = 0, frame = null, depth = 0, presenting = false, destroyed = false;
  let timestamp = null;
  const now = () => timestamp ?? window.performance.now();
  const schedule = () => {
    const needed = callbacks.size > 0 || dirty.size > 0 || active.size > 0;
    if (destroyed || presenting) return;
    if (needed) frame ??= window.requestAnimationFrame(tick);
    else if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };
  const flush = (advance = false) => {
    const pending = new Set(advance ? [...active, ...dirty] : dirty);
    dirty.clear();
    for (const publish of pending) {
      if (publish(now(), advance)) active.add(publish);
      else active.delete(publish);
    }
  };
  const tick = (time) => {
    frame = null;
    presenting = true;
    timestamp = time;
    const ready = [...lanes.input.values(), ...lanes.present.values()];
    lanes.input.clear();
    lanes.present.clear();
    try {
      for (const callback of ready) callback(time);
    } finally {
      try {
        flush(true);
      } finally {
        timestamp = null;
        presenting = false;
        schedule();
      }
    }
  };
  return {
    now,
    request(callback, lane = "present") {
      const id = ++next;
      if (!destroyed) {
        lanes[lane].set(id, callback);
        schedule();
      }
      return id;
    },
    cancel(id) {
      lanes.input.delete(id);
      lanes.present.delete(id);
      schedule();
    },
    changed(publish) {
      if (destroyed) return;
      dirty.add(publish);
      if (!presenting && depth === 0) flush();
      schedule();
    },
    remove(publish) {
      dirty.delete(publish);
      active.delete(publish);
      schedule();
    },
    batch(work) {
      depth++;
      try {
        return work();
      } finally {
        if (--depth === 0 && !presenting) {
          flush();
          schedule();
        }
      }
    },
    destroy() {
      destroyed = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      callbacks.clear();
      dirty.clear();
      active.clear();
    }
  };
}

// src/renderers/css/stars/opacity-fader.ts
var clamp = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
var fixed = (value) => ({ from: value, target: value, started: 0, duration: 0, ease: false });
function ease(progress) {
  let lo = 0, hi = 1, t = progress;
  for (let i = 0; i < 20; i++) {
    const x = 0.75 * t * (1 - t) + t * t * t;
    if (Math.abs(x - progress) < 1e-7) break;
    if (x < progress) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) ** 2 * t * 0.1 + 3 * (1 - t) * t * t + t * t * t;
}
var valueAt = (track, time) => {
  if (track.duration === 0 || time >= track.started + track.duration) return track.target;
  const p = Math.max(0, (time - track.started) / track.duration);
  return track.from + (track.target - track.from) * (track.ease ? ease(p) : p);
};
var running = (track, time) => track.from !== track.target && time < track.started + track.duration;
function createOpacityFader(window, sharedClock) {
  const clock = sharedClock ?? createOpacityClock(window);
  const entries = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Set(), dirty = /* @__PURE__ */ new Set();
  let destroyed = false, animationEnabled = true;
  const entryFor = (element) => {
    let entry = entries.get(element);
    if (!entry) {
      const initial = clamp(Number.parseFloat(element.style.opacity));
      entry = { element, alpha: fixed(initial), multiplier: fixed(1), suppression: fixed(1), visible: true, written: Number.NaN };
      entries.set(element, entry);
    }
    return entry;
  };
  const flush = (time, advance) => {
    const publishing = advance ? /* @__PURE__ */ new Set([...pending, ...dirty]) : new Set(dirty);
    dirty.clear();
    for (const entry of publishing) {
      const alpha = entry.visible ? valueAt(entry.alpha, time) * valueAt(entry.multiplier, time) * valueAt(entry.suppression, time) : 0;
      if (entry.written !== alpha) {
        entry.element.style.opacity = String(alpha);
        entry.written = alpha;
      }
      if (!entry.visible || entry.suppression.target === 0 && !running(entry.suppression, time) || !(running(entry.alpha, time) || running(entry.multiplier, time) || running(entry.suppression, time))) pending.delete(entry);
      else pending.add(entry);
    }
    return pending.size > 0;
  };
  const changed = (entry) => {
    if (entry.visible) dirty.add(entry);
    clock.changed(flush);
  };
  const target = (entry, track, alpha, duration, preserveDeadline = false, eased = false) => {
    const value = clamp(alpha), time = clock.now(), ms = animationEnabled && Number.isFinite(duration) ? Math.max(0, duration) : 0;
    if (track.target === value && (ms > 0 || track.duration === 0)) return;
    const current = valueAt(track, time), deadline = track.started + track.duration;
    track.from = current;
    track.target = value;
    track.started = time;
    track.duration = preserveDeadline && track.duration > 0 ? Math.max(0, deadline - time) : ms;
    if (ms === 0 || current === value) track.duration = 0;
    track.ease = eased;
    changed(entry);
  };
  return Object.freeze({
    setAnimationEnabled(enabled) {
      if (destroyed || enabled === animationEnabled) return;
      animationEnabled = enabled;
      if (enabled || pending.size === 0) return;
      for (const entry of pending) {
        for (const track of [entry.alpha, entry.multiplier, entry.suppression]) {
          track.from = track.target;
          track.duration = 0;
        }
        dirty.add(entry);
      }
      clock.changed(flush);
    },
    current(element) {
      const entry = entries.get(element);
      return entry ? valueAt(entry.alpha, clock.now()) : clamp(Number.parseFloat(element.style.opacity));
    },
    set(element, alpha, durationMs = 0, preserveDeadline = false) {
      if (destroyed) return;
      const entry = entryFor(element);
      target(entry, entry.alpha, alpha, durationMs, preserveDeadline);
      if (Number.isNaN(entry.written)) changed(entry);
    },
    multiply(element, alpha, durationMs = 0) {
      if (destroyed) return;
      const entry = entryFor(element);
      target(entry, entry.multiplier, alpha, durationMs, false, true);
    },
    suppress(element, suppressed, durationMs = 0) {
      if (destroyed) return;
      const entry = entryFor(element);
      target(entry, entry.suppression, suppressed ? 0 : 1, durationMs, false, true);
    },
    visible(element, visible) {
      const entry = entries.get(element);
      if (destroyed || !entry || entry.visible === visible) return;
      entry.visible = visible;
      dirty.add(entry);
      clock.changed(flush);
    },
    cancel(element) {
      const entry = entries.get(element);
      if (entry) {
        pending.delete(entry);
        dirty.delete(entry);
      }
      entries.delete(element);
      if (pending.size === 0 && dirty.size === 0) clock.remove(flush);
    },
    batch: clock.batch,
    stats: () => ({ active: pending.size, retained: entries.size }),
    destroy() {
      destroyed = true;
      pending.clear();
      dirty.clear();
      entries.clear();
      clock.remove(flush);
      if (!sharedClock) clock.destroy();
    }
  });
}

// src/renderers/css/labels/label-occlusion.ts
var owners = /* @__PURE__ */ new WeakMap();
function createOcclusionState() {
  let rects = [];
  const listeners = /* @__PURE__ */ new Set();
  return {
    read: () => rects,
    publish(next) {
      if (next.length === rects.length && next.every((rect, index) => {
        const old = rects[index];
        return rect.left === old.left && rect.top === old.top && rect.right === old.right && rect.bottom === old.bottom;
      })) return;
      rects = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
function labelOcclusionFor(document) {
  let owner = owners.get(document);
  if (!owner) {
    owner = createOcclusionState();
    owners.set(document, owner);
  }
  return owner;
}

// src/renderers/css/labels/screen-label-layout.ts
function labelRectsOverlap(a, b, paddingPx = 3) {
  return a.left <= b.right + paddingPx && a.right + paddingPx >= b.left && a.top <= b.bottom + paddingPx && a.bottom + paddingPx >= b.top;
}

// src/renderers/css/labels/surface-feature-layout.ts
var POINT_LABEL_GAP_PX = 8;
var POINT_DOT_RADIUS_PX = 3;
var VIEWPORT_MARGIN_PX = 4;
var LIMB_FADE_WIDTH = 0.2;
function projectSurfaceFeature(feature, m, focalPixels, principal) {
  const [ax, ay, az] = feature.anchorUnits, [nx, ny, nz] = feature.normal;
  const px = m[0] * ax + m[4] * ay + m[8] * az + m[12];
  const py = m[1] * ax + m[5] * ay + m[9] * az + m[13];
  const pz = m[2] * ax + m[6] * ay + m[10] * az + m[14];
  if (!(pz < 0)) return null;
  const ex = m[0] * nx + m[4] * ny + m[8] * nz;
  const ey = m[1] * nx + m[5] * ny + m[9] * nz;
  const ez = m[2] * nx + m[6] * ny + m[10] * nz;
  const normalLength = Math.hypot(ex, ey, ez), eyeDistance = Math.hypot(px, py, pz);
  if (!(normalLength > 0) || !(eyeDistance > 0)) return null;
  const facing = -(ex * px + ey * py + ez * pz) / (normalLength * eyeDistance);
  const scale = Math.hypot(m[0], m[1], m[2]);
  const depth = -pz;
  return {
    x: principal[0] + focalPixels * px / depth,
    y: principal[1] + focalPixels * py / depth,
    facing,
    diameterPx: 2 * feature.radiusUnits * scale * focalPixels / depth
  };
}
function zoomShare(zoom, minimumZoom, maximumZoom) {
  if (!(maximumZoom > minimumZoom) || !(minimumZoom > 0) || !(zoom > 0)) return 0;
  return Math.max(0, Math.min(1, Math.log(zoom / minimumZoom) / Math.log(maximumZoom / minimumZoom)));
}
function passesZoomGate(zoom, minimumZoom, maximumZoom, policy) {
  if (policy.minimumZoomShare <= 0) return true;
  if (zoom === void 0) return false;
  return zoomShare(zoom, minimumZoom, maximumZoom) >= policy.minimumZoomShare - 1e-6;
}
function projectSurfaceOutline(outline, m, focalPixels, principal, pieces) {
  if (outline.kind === "trace") {
    const chords2 = [];
    for (const path of outline.paths) {
      let previous = null;
      for (const vertex of path) {
        const projected = projectSurfaceFeature({ anchorUnits: vertex, normal: vertex, radiusUnits: 0 }, m, focalPixels, principal);
        const point = projected && projected.facing > 0 ? [projected.x, projected.y] : null;
        if (previous && point && chords2.length < pieces) chords2.push([previous[0], previous[1], point[0], point[1]]);
        previous = point;
      }
    }
    return chords2;
  }
  const vertices = [];
  if (outline.kind === "circle") {
    for (let index = 0; index < pieces; index++) {
      const phi = index / pieces * 2 * Math.PI, c = Math.cos(phi), s = Math.sin(phi);
      vertices.push([outline.center[0] + outline.east[0] * c + outline.north[0] * s, outline.center[1] + outline.east[1] * c + outline.north[1] * s, outline.center[2] + outline.east[2] * c + outline.north[2] * s]);
    }
  } else for (const point of outline.points.slice(0, pieces)) vertices.push(point);
  const points = vertices.map((vertex) => {
    const projected = projectSurfaceFeature({ anchorUnits: vertex, normal: vertex, radiusUnits: 0 }, m, focalPixels, principal);
    return projected && projected.facing > 0 ? [projected.x, projected.y] : null;
  });
  const chords = [];
  for (let index = 0; index < points.length; index++) {
    const start = points[index], end = points[(index + 1) % points.length];
    if (start && end) chords.push([start[0], start[1], end[0], end[1]]);
  }
  return chords;
}
function surfaceLabelRect(kind, projected, width, height) {
  if (kind === "point") {
    return { left: projected.x - POINT_DOT_RADIUS_PX, top: projected.y - height / 2, right: projected.x + POINT_LABEL_GAP_PX + width, bottom: projected.y + height / 2 };
  }
  return { left: projected.x - width / 2, top: projected.y - height / 2, right: projected.x + width / 2, bottom: projected.y + height / 2 };
}
function surfaceLabelOpacity(facing, policy) {
  const t = Math.max(0, Math.min(1, (facing - policy.limbCosine) / LIMB_FADE_WIDTH));
  return t * t * (3 - 2 * t);
}
function admitSurfaceFeatureLabels(candidates, policy, viewport, previous, blockers = [], pinned = null) {
  const halfWidth = viewport.width / 2, halfHeight = viewport.height / 2;
  const eligible = [];
  candidates.forEach((candidate, rank) => {
    const { projected } = candidate;
    if (!(projected.facing > policy.limbCosine)) return;
    const unsized = projected.diameterPx === 0;
    if (!unsized && !(projected.diameterPx >= policy.minimumDiameterPixels) && rank >= policy.alwaysVisibleCount && candidate.index !== pinned) return;
    if (!(candidate.width > 0) || !(candidate.height > 0)) return;
    const rect = surfaceLabelRect(candidate.kind, projected, candidate.width, candidate.height);
    if (rect.left < -halfWidth + VIEWPORT_MARGIN_PX || rect.right > halfWidth - VIEWPORT_MARGIN_PX || rect.top < -halfHeight + VIEWPORT_MARGIN_PX || rect.bottom > halfHeight - VIEWPORT_MARGIN_PX) return;
    eligible.push({ ...candidate, rect, rank });
  });
  const ordered = [...eligible.filter((item) => item.index === pinned), ...eligible.filter((item) => item.index !== pinned && previous.has(item.index)), ...eligible.filter((item) => item.index !== pinned && !previous.has(item.index))];
  const accepted = [], occupied = [...blockers];
  for (const item of ordered) {
    if (accepted.length >= policy.maximumVisible) break;
    if (occupied.some((rect) => labelRectsOverlap(item.rect, rect))) continue;
    occupied.push(item.rect);
    accepted.push({ index: item.index, rect: item.rect, opacity: surfaceLabelOpacity(item.projected.facing, policy) });
  }
  return { accepted, eligible: eligible.length };
}

// src/renderers/css/labels/surface-feature-catalog.ts
var KINDS = ["point", "linear", "region"];
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value;
}
function text(value, label) {
  if (typeof value !== "string") throw new TypeError(`Invalid prepared ${label}.`);
  return value;
}
function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value;
}
function vector(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`Invalid prepared ${label}.`);
  return [finite(value[0], label), finite(value[1], label), finite(value[2], label)];
}
function onBody(point, plan) {
  const length = Math.hypot(...point), band = plan.surfaceRadiusUnits, ellipsoid = plan.surfaceEllipsoidUnits;
  if (ellipsoid) {
    const up = point[0] * ellipsoid.north[0] + point[1] * ellipsoid.north[1] + point[2] * ellipsoid.north[2];
    const share = Math.sqrt(Math.max(0, length * length - up * up) / (ellipsoid.equatorial * ellipsoid.equatorial) + up * up / (ellipsoid.polar * ellipsoid.polar));
    return share >= ellipsoid.minimumShare * (1 - 1e-3) && share <= ellipsoid.maximumShare * (1 + 1e-3);
  }
  return band ? length >= band.minimum * (1 - 1e-3) && length <= band.maximum * (1 + 1e-3) : Math.abs(length - plan.meshRadiusUnits) <= 1e-3 * plan.meshRadiusUnits;
}
function surfaceCeiling(plan) {
  return plan.surfaceEllipsoidUnits ? plan.surfaceEllipsoidUnits.equatorial * plan.surfaceEllipsoidUnits.maximumShare : plan.surfaceRadiusUnits?.maximum ?? plan.meshRadiusUnits;
}
function parseOutline(value, plan) {
  const outline = object(value, "feature outline");
  if (outline.kind === "circle") {
    const center = vector(outline.center, "feature rim centre"), east = vector(outline.east, "feature rim east"), north = vector(outline.north, "feature rim north");
    const ceiling = surfaceCeiling(plan) * (1 + 1e-3);
    if (Math.hypot(...center) > ceiling || Math.abs(Math.hypot(...east) - Math.hypot(...north)) > 1e-3 * plan.meshRadiusUnits) throw new TypeError("Surface feature rim is not on the prepared body.");
    return Object.freeze({ kind: "circle", center, east, north });
  }
  if (outline.kind === "box") {
    if (!Array.isArray(outline.points) || outline.points.length < 4 || outline.points.length > plan.outline.pieces) throw new TypeError("Surface feature extent polygon is out of range.");
    const points = outline.points.map((point) => {
      const p = vector(point, "feature extent point");
      if (!onBody(p, plan)) throw new TypeError("Surface feature extent is not on the prepared body.");
      return p;
    });
    return Object.freeze({ kind: "box", points: Object.freeze(points) });
  }
  if (outline.kind === "trace") {
    if (!Array.isArray(outline.paths) || !outline.paths.length) throw new TypeError("Surface feature trace has no paths.");
    let vertices = 0;
    const paths = outline.paths.map((path) => {
      if (!Array.isArray(path) || path.length < 2) throw new TypeError("Surface feature trace path is too short.");
      vertices += path.length;
      return Object.freeze(path.map((point) => {
        const p = vector(point, "feature trace point");
        if (!onBody(p, plan)) throw new TypeError("Surface feature trace is not on the prepared body.");
        return p;
      }));
    });
    if (vertices > plan.outline.pieces) throw new TypeError("Surface feature trace exceeds the outline pool.");
    return Object.freeze({ kind: "trace", paths: Object.freeze(paths) });
  }
  throw new TypeError("Surface feature outline kind is unknown.");
}
function zoomShare2(value) {
  if (value === void 0) return 0;
  const share = finite(value, "feature zoom share");
  if (share < 0 || share > 1) throw new TypeError("Surface feature zoom share is out of range.");
  return share;
}
function parseNote(value) {
  if (value === void 0) return null;
  const note = object(value, "feature note");
  const noteText = text(note.text, "feature note text"), title = text(note.title, "feature note title"), url = text(note.url, "feature note url"), credit = note.credit === "" ? "" : text(note.credit, "feature note credit");
  if (!noteText.trim() || noteText.length > 400 || !/^https?:\/\//u.test(url)) throw new TypeError("Surface feature note is invalid.");
  return Object.freeze({ text: noteText, title, url, credit });
}
function parsePreparedSurfaceFeatureCatalog(value, plan, objectId, descriptor = plan.catalog) {
  const catalog = object(value, "surface feature catalogue");
  if (catalog.schema !== "cssearth-prepared-surface-features@1" || catalog.objectId !== objectId) throw new TypeError("Surface feature catalogue is incompatible.");
  if (!Array.isArray(catalog.features) || catalog.features.length !== descriptor.count) throw new TypeError("Surface feature catalogue count differs from its plan.");
  const ids = /* @__PURE__ */ new Set();
  const features = catalog.features.map((input, index) => {
    const feature = object(input, `surface feature ${index}`);
    const id = text(feature.id, "feature id"), kind = text(feature.kind, "feature kind");
    if (!/^[0-9]+$/u.test(id) || ids.has(id) || !KINDS.includes(kind)) throw new TypeError("Surface feature identity or kind is invalid.");
    ids.add(id);
    const anchorUnits = vector(feature.anchorUnits, "feature anchor"), normal = vector(feature.normal, "feature normal");
    const radiusUnits = finite(feature.radiusUnits, "feature radius"), diameterKm = finite(feature.diameterKm, "feature diameter");
    if (!(radiusUnits >= 0) || !(diameterKm >= 0) || !onBody(anchorUnits, plan) || Math.abs(Math.hypot(...normal) - 1) > 1e-3) throw new TypeError("Surface feature geometry is not on the prepared body.");
    const outline = parseOutline(feature.outline, plan);
    const name = text(feature.name, "feature name"), link = text(feature.link, "feature link");
    if (!Array.isArray(feature.searchNames) || !feature.searchNames.length || !feature.searchNames.every((value2) => typeof value2 === "string" && value2.length > 0)) throw new TypeError("Surface feature search names are invalid.");
    const searchNames = Object.freeze([...feature.searchNames]), searchContext = text(feature.searchContext, "feature search context");
    if (!name.trim() || !/^https?:\/\//u.test(link)) throw new TypeError("Surface feature caption is invalid.");
    if (feature.searchOnly !== void 0 && feature.searchOnly !== true) throw new TypeError("Surface feature searchOnly must be true when present.");
    return Object.freeze({
      id,
      name,
      kind,
      type: text(feature.type, "feature type"),
      code: text(feature.code, "feature code"),
      diameterKm,
      longitudeDeg: finite(feature.longitudeDeg, "feature longitude"),
      latitudeDeg: finite(feature.latitudeDeg, "feature latitude"),
      anchorUnits,
      normal,
      radiusUnits,
      outline,
      searchNames,
      searchContext,
      origin: text(feature.origin, "feature origin"),
      approved: text(feature.approved, "feature approval"),
      quad: text(feature.quad, "feature quad"),
      link,
      credit: text(feature.credit, "feature credit"),
      note: parseNote(feature.note),
      facilityId: feature.facilityId === void 0 ? null : text(feature.facilityId, "feature facility"),
      minimumZoomShare: zoomShare2(feature.minimumZoomShare),
      searchOnly: feature.searchOnly === true
    });
  });
  return Object.freeze({
    schema: "cssearth-prepared-surface-features@1",
    objectId,
    source: text(catalog.source, "catalogue source"),
    snapshotDate: text(catalog.snapshotDate, "catalogue snapshot"),
    sourcePage: text(catalog.sourcePage, "catalogue page"),
    license: text(catalog.license, "catalogue license"),
    qualification: text(catalog.qualification, "catalogue qualification"),
    features: Object.freeze(features)
  });
}
async function loadPinnedCatalog(plan, objectId, descriptor, signal, transport) {
  const response = await transport(descriptor.url, { signal });
  if (!response.ok) throw new Error(`Surface feature catalogue ${objectId} ${descriptor.url} failed: HTTP ${response.status}.`);
  return parsePreparedSurfaceFeatureCatalog(await response.json(), plan, objectId, descriptor);
}
async function loadPreparedSurfaceFeatureCatalog(plan, objectId, signal, transport = (url, init) => fetch(url, init)) {
  return loadPinnedCatalog(plan, objectId, plan.catalog, signal, transport);
}
async function loadPreparedSurfaceFeatureBank(plan, objectId, id, signal, transport = (url, init) => fetch(url, init)) {
  if (!plan.selection) return null;
  const descriptor = plan.selection.banks[surfaceFeatureBankIndex(id, plan.selection.banks.length)];
  if (!descriptor) throw new TypeError("Surface feature selection bank is missing.");
  return loadPinnedCatalog(plan, objectId, descriptor, signal, transport);
}

// src/platform/vector3.mts
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

// packages/engine/dist/index.js
var CANCELLED = Object.freeze({ cancelled: true });
var MAX_CLEARANCE_FRACTION = 10 ** 0.1 - 1;
function composeDragRotation(next, previous) {
  const [x, y, z, w] = next;
  const [a, b, c, d] = previous;
  return [
    w * a + x * d + y * c - z * b,
    w * b - x * c + y * d + z * a,
    w * c + x * b - y * a + z * d,
    w * d - x * a - y * b - z * c
  ];
}
var TRACKBALL_DRAG_INERTIA = Object.freeze({
  schema: "cssearth-trackball-throw@10",
  qualification: "REFERENCE_APP_7.3.7.1327_NATIVE_PROJECTION_AND_DECOMPILED_THROW",
  rendererSha256: "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  historyCapacity: 16,
  averagingFrameCount: 5,
  // The normalized pointer spans two units across the viewport. Its release
  // threshold of five viewport-scaled units is 2.5 CSS pixels, not five.
  minimumThrowDisplacementPixels: 2.5,
  releaseFreshnessMilliseconds: 100,
  directAngularDegreesPerTrackballRadius: 47.5,
  directAngularResponseByZoom: Object.freeze({
    model: "linear-clamped-native-training-fit",
    interceptDegrees: 69.8238784558683,
    slopeDegreesPerZoom: -16.30629044362304,
    minimumDegrees: 40,
    maximumDegrees: 52.5
  }),
  directPitchResponse: 1,
  directPitchResponseByZoom: Object.freeze({
    model: "linear-clamped-native-pure-vertical-fit",
    intercept: 0.9768198038991756,
    slopePerZoom: 0.21000705516484433,
    minimum: 1.2025381100738586,
    maximum: 1.3504854183805297
  }),
  directPitchResponseEvidence: Object.freeze({
    model: "two-point-native-endpoint-to-browser-pure-vertical-fit",
    calibrationScenarios: Object.freeze([
      "training-baseline-high-vertical-near",
      "training-baseline-high-vertical-far"
    ])
  }),
  maximumPitchVelocityDegreesPerSecond: 30,
  maximumYawVelocityDegreesPerSecond: 90,
  rotationalDampingSeconds: 1.2,
  stopVelocityRatio: 33e-4,
  sourceFunctions: Object.freeze({
    configuration: "0x005b93a0",
    trackballConstructor: "0x005ae654",
    directTrackballMove: "0x005aec2c+0x005d10a2+0x005d1d70",
    releaseThrow: "0x005ae6ea",
    velocityAverage: "0x005ae936",
    rotationalDecay: "0x005b082c+0x005d23cc"
  })
});
var ADAPTATION_LUMINANCE_CD_M2 = 0.052;
var EXPOSURE_SCALE = 2;
var STAR_LINEAR_SCALE = 1.0727;
var STAR_RADIUS_MAX_PX = 1.25;
var STAR_INTENSITY_MAX = 0.95;
var HALO_PEAK = 0.08;
var SCREEN_FACTOR_RANGE = Object.freeze([0.7, 1.5]);
var EXPOSURE_KNOBS = Object.freeze({
  adaptationLuminanceCdM2: ADAPTATION_LUMINANCE_CD_M2,
  exposureScale: EXPOSURE_SCALE,
  intensityMax: STAR_INTENSITY_MAX,
  maxRadiusPx: STAR_RADIUS_MAX_PX,
  haloPeak: HALO_PEAK,
  linearScale: STAR_LINEAR_SCALE
});
var STAR_LABEL_POLICY = Object.freeze({
  capPixels: 12,
  gapPixels: 7,
  spacingPixels: 4,
  boxHeightCaps: 2.2,
  poolSize: 1,
  maxAlpha: 0.55,
  maxAlphaStep: 0.1,
  capHeightEm: 0.72,
  magnitudeOffset: 0,
  color: "#f4f6fb",
  fontWeight: 500,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
});
var DEFAULT_LABEL_POLICY = Object.freeze({
  model: "priority-declutter-cap-height-captions",
  // Height of a capital letter on screen: the shell's navigation labels
  // (14 px in the UI stack, cap height 0.72 em); the reference's own 12 px
  // is a session knob away (the runtime's label policy setter).
  capPixels: 10.08,
  // Gap between the marker's edge and the bottom of the caption.
  gapPixels: 7,
  // Clearance two captions must keep (the reference's LABEL_SPACING_PIXELS).
  spacingPixels: 4,
  // Box height in cap heights (ascenders and descenders included).
  boxHeightCaps: 2.2,
  // Retained slots; also the most captions ever visible at once.
  poolSize: 8,
  // Candidate capacity of the one pass.
  candidateCapacity: 64,
  // Alpha ceiling and the largest alpha change per publication.
  maxAlpha: 0.72,
  maxAlphaStep: 0.1,
  // Cap height of the shell's UI font stack as a share of the em: the
  // reference's own fallback for fonts without ink metrics (system-ui
  // faces measure 0.70-0.73); the acceptance test measures the painted
  // capitals against `capPixels` with that spread as its tolerance.
  capHeightEm: 0.72
});

// src/renderers/css/navigation/world-camera-math.ts
function rotateWorldPosition(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2]
  ];
}
function worldRotationFromQuaternion([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y)
  ];
}

// src/renderers/css/labels/surface-feature-flight.ts
var unit = (v) => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var unitQuaternion = (q) => {
  const length = Math.hypot(...q);
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
};
function surfaceOrbitRotation(world, originM, targetDirection) {
  const eye = world.pose.positionM;
  const from = unit([eye[0] - originM[0], eye[1] - originM[1], eye[2] - originM[2]]), to = unit(targetDirection);
  const rotation = [...cross3(from, to), 1 + dot(from, to)];
  if (Math.hypot(...rotation) < 1e-8) return [...unit(cross3(from, Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), 0];
  return unitQuaternion(rotation);
}
function surfaceOrbitPose(world, originM, rotation, share, distanceM) {
  const [x, y, z, w] = rotation, angle = 2 * Math.acos(Math.max(-1, Math.min(1, w)));
  const axisLength = Math.hypot(x, y, z);
  const partial = axisLength < 1e-12 ? [0, 0, 0, 1] : [x / axisLength * Math.sin(share * angle / 2), y / axisLength * Math.sin(share * angle / 2), z / axisLength * Math.sin(share * angle / 2), Math.cos(share * angle / 2)];
  const eye = world.pose.positionM;
  const relative = unit([eye[0] - originM[0], eye[1] - originM[1], eye[2] - originM[2]]);
  const direction = rotateWorldPosition(worldRotationFromQuaternion(partial), relative);
  return { ...world, pose: {
    positionM: [originM[0] + direction[0] * distanceM, originM[1] + direction[1] * distanceM, originM[2] + direction[2] * distanceM],
    orientationXyzw: unitQuaternion(composeDragRotation(partial, world.pose.orientationXyzw))
  } };
}
function flyToSurfaceDirection(navigation, { directionWorld, distanceM, durationMilliseconds = 900, reducedMotion = false, signal, windowTarget }) {
  if (signal?.aborted) return { done: Promise.resolve({ completed: false }), cancel() {
  } };
  const origin = navigation.frame.originM;
  const start = navigation.capture();
  const rotation = surfaceOrbitRotation(start, origin, directionWorld);
  const startDistance = Math.hypot(start.pose.positionM[0] - origin[0], start.pose.positionM[1] - origin[1], start.pose.positionM[2] - origin[2]);
  const duration = reducedMotion ? 0 : Math.max(0, durationMilliseconds);
  const ease2 = (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const flight = navigation.motion.fly({ windowTarget, signal, durationMilliseconds: duration, sample(progress, signal2) {
    const share = ease2(progress);
    const pose = surfaceOrbitPose(start, origin, rotation, share, startDistance + (distanceM - startDistance) * share);
    return navigation.apply(pose, { signal: signal2 });
  } });
  return { done: flight.finished, cancel: flight.cancel };
}

// src/renderers/css/labels/surface-feature-caption.ts
var kilometres = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
var SITE_CODES = /* @__PURE__ */ new Set(["LS", "IM", "SS", "RT"]);
function surfaceFeatureCaption(root) {
  const document = root.ownerDocument;
  let tooltip = root.querySelector("[data-feature-tooltip]");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.dataset.featureTooltip = "";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    tooltip.style.cssText = "position:absolute;left:50%;top:50%;pointer-events:none";
    for (const [tag, name] of [["b", "name"], ["span", "detail"], ["p", "origin"], ["p", "note"], ["small", "credit"]]) {
      const field = document.createElement(tag);
      field.setAttribute(`data-feature-tooltip-${name}`, "");
      tooltip.append(field);
    }
    root.append(tooltip);
  }
  const card = tooltip;
  const fields = Object.fromEntries(["name", "detail", "origin", "note", "credit"].map((name) => {
    const field = card.querySelector(`[data-feature-tooltip-${name}]`);
    if (!field) throw new TypeError(`Prepared feature caption is missing ${name}.`);
    return [name, field];
  }));
  return { element: card, show(feature) {
    fields.name.textContent = feature.name;
    fields.detail.textContent = feature.diameterKm > 0 ? `${feature.type} \xB7 ${kilometres.format(feature.diameterKm)} km` : SITE_CODES.has(feature.code) ? feature.type : `${feature.type} \xB7 size unpublished`;
    fields.origin.textContent = feature.origin;
    fields.note.textContent = feature.note?.text ?? "";
    fields.credit.textContent = feature.note?.credit ? `${feature.credit} \xB7 ${feature.note.credit}` : feature.credit;
    card.dataset.featureTooltipFor = feature.id;
    card.hidden = false;
  } };
}

// src/renderers/css/labels/surface-feature-labels.ts
var LABEL_FADE_MS = 200;
var SURFACE_PICK_RANK = 1e6;
function format(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(2)).toString();
}
var ARRIVAL_DIAMETER_SHARE = 0.45;
var MINIMUM_FRAMED_RADIUS_M = 25e3;
var CLICK_SLOP_PIXELS = 5;
var LABELS_PER_FRAME = 128;
function mountSurfaceFeatureLabels({ host, plan, objectId, target, scene, zoomRange, navigation, flightLimits, onFlight, onSelect, lifetime, pickingHost, inputSurface, onError, transport }) {
  if (!host?.ownerDocument || !target || !scene.contains(target)) throw new TypeError("Surface feature labels need a host and a mesh target inside the scene.");
  const document = host.ownerDocument, windowTarget = document.defaultView;
  if (!windowTarget) throw new TypeError("Surface feature labels require a mounted window.");
  const root = host.querySelector(":scope > .prepared-surface-features") ?? document.createElement("div");
  if (root.dataset.surfaceFeatures && root.dataset.surfaceFeatures !== objectId) throw new TypeError("Prepared feature caption belongs to another object.");
  root.className = "prepared-surface-features";
  root.dataset.surfaceFeatures = objectId;
  root.style.cssText = "position:absolute;inset:0;z-index:1;pointer-events:none";
  const outline = [];
  for (let index = 0; index < plan.outline.pieces; index++) {
    const piece = document.createElement("s");
    piece.dataset.featureOutlinePiece = "";
    piece.style.cssText = "position:absolute;left:50%;top:50%;width:1px;transform-origin:0 50%;visibility:hidden;pointer-events:none";
    root.appendChild(piece);
    outline.push(piece);
  }
  const entries = [];
  const caption = surfaceFeatureCaption(root), tooltip = caption.element;
  host.appendChild(root);
  const picking = screenPicking(pickingHost);
  const fader = createOpacityFader(windowTarget);
  const controller = new AbortController();
  const labelsEnabled = () => document.body.dataset.surfaceLabels === "on";
  let destroyed = false, playing = false, enabled = false, frames = 0, zoomGate = false, outlinePieces = 0;
  let load = { kind: "idle" };
  let view = null;
  let matrix = null, local = null, flight = null;
  let resolveLoaded, rejectLoaded;
  const loadedCatalog = new Promise((resolve, reject) => {
    resolveLoaded = resolve;
    rejectLoaded = reject;
  });
  loadedCatalog.catch(() => {
  });
  const selectionBanks = /* @__PURE__ */ new Map();
  let pendingFrame = null, loopFrame = null;
  let visible = /* @__PURE__ */ new Set(), rects = /* @__PURE__ */ new Map(), eligible = 0;
  let hoveredIndex = null, pinnedIndex = null, shownIndex = null;
  const measure = () => {
    if (destroyed || load.kind !== "loaded") return;
    for (const entry of entries) entry.measured = false;
    schedule();
  };
  const fonts = document.fonts;
  fonts?.addEventListener("loadingdone", measure);
  void fonts?.ready.then(measure);
  const onHover = () => {
    if (!labelsEnabled()) {
      hoveredIndex = null;
      presentCaption();
      return;
    }
    const index = entries.findIndex((entry) => entry.element.dataset.objectHovered === "true");
    hoveredIndex = index >= 0 ? index : null;
    presentCaption();
  };
  pickingHost.addEventListener("objecthoverchange", onHover);
  const activations = [];
  const createEntry = () => {
    const index = entries.length;
    const element = document.createElement("span");
    element.dataset.featureLabel = "";
    element.dataset.surfacePick = "true";
    element.style.cssText = "position:absolute;left:50%;top:50%;white-space:nowrap;visibility:hidden;opacity:0;pointer-events:none";
    element.ariaHidden = "true";
    root.appendChild(element);
    const entry = { element, feature: null, width: 0, height: 0, measured: false, targetOpacity: 0, hideTimer: null, x: 0, y: 0 };
    const activate = (event) => {
      if (!labelsEnabled() || !visible.has(index)) return;
      event.preventDefault();
      if (pinnedIndex === index) {
        clearSelection();
        return;
      }
      if (onSelect) onSelect(entries[index].feature.id);
      else void selectIndex(index);
    };
    element.addEventListener("click", activate);
    entries.push(entry);
    activations.push(activate);
    return entry;
  };
  const createEntries = () => {
    if (entries.length) return;
    for (let index = 0; index < plan.catalog.count; index++) createEntry();
  };
  let press = null;
  const onPress = (event) => {
    if (labelsEnabled()) requestLoading();
    press = event.target === inputSurface && event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  };
  const onWheel = () => {
    if (labelsEnabled()) requestLoading();
  };
  const onSurfaceClick = (event) => {
    if (pinnedIndex === null || event.target !== inputSurface || event.button !== 0) return;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PIXELS) return;
    clearSelection();
  };
  const onKey = (event) => {
    if (labelsEnabled()) requestLoading();
    if (event.key === "Escape" && pinnedIndex !== null) clearSelection();
  };
  windowTarget.addEventListener("pointerdown", onPress, { capture: true });
  inputSurface.addEventListener("wheel", onWheel, { passive: true });
  windowTarget.addEventListener("click", onSurfaceClick);
  windowTarget.addEventListener("keydown", onKey);
  lifetime.onDispose(destroy);
  const occlusion = labelOcclusionFor(host.ownerDocument);
  lifetime.onDispose(occlusion.subscribe(() => refresh()));
  let navigationInFlight = false;
  function requestLoading() {
    if (!navigationInFlight) startLoading();
    else if (load.kind === "idle") load = { kind: "held" };
  }
  function startLoading() {
    if (destroyed || load.kind !== "idle" && load.kind !== "held") return;
    load = { kind: "fetching" };
    void loadPreparedSurfaceFeatureCatalog(plan, objectId, controller.signal, transport).then((catalog) => {
      if (destroyed) return;
      createEntries();
      catalog.features.forEach((feature, index) => {
        entries[index].feature = feature;
      });
      load = { kind: "populating", catalog, frame: null };
      populate(0);
    }, (failure) => {
      if (destroyed || controller.signal.aborted) {
        rejectLoaded(failure);
        return;
      }
      load = { kind: "failed", error: failure instanceof Error ? failure.message : String(failure) };
      rejectLoaded(failure);
      onError(failure);
    });
  }
  function schedule() {
    if (destroyed || pendingFrame !== null) return;
    pendingFrame = windowTarget.requestAnimationFrame(() => {
      pendingFrame = null;
      refresh();
    });
  }
  function populate(start) {
    const populating = load;
    if (destroyed || populating.kind !== "populating") return;
    populating.frame = null;
    const { catalog } = populating, end = Math.min(catalog.features.length, start + LABELS_PER_FRAME);
    for (let index = start; index < end; index++) {
      const entry = entries[index], feature = entry.feature;
      populateEntry(entry, feature);
    }
    if (end < catalog.features.length) {
      populating.frame = windowTarget.requestAnimationFrame(() => populate(end));
      return;
    }
    load = { kind: "loaded", catalog };
    schedule();
    resolveLoaded(catalog);
  }
  function populateEntry(entry, feature) {
    entry.feature = feature;
    entry.element.dataset.featureLabel = feature.id;
    entry.element.dataset.featureKind = feature.kind;
    entry.element.textContent = feature.name;
  }
  async function selectionFeature(id) {
    const resident = entries.find((entry) => entry.feature?.id === id)?.feature;
    if (resident) return resident;
    if (!plan.selection) return null;
    const descriptor = plan.selection.banks[surfaceFeatureBankIndex(id, plan.selection.banks.length)];
    if (!descriptor) return null;
    let pending = selectionBanks.get(descriptor.url);
    if (!pending) {
      pending = loadPreparedSurfaceFeatureBank(plan, objectId, id, controller.signal, transport).then((value) => {
        if (!value) throw new Error("Prepared feature selection bank is unavailable.");
        return value;
      }).catch((failure) => {
        selectionBanks.delete(descriptor.url);
        throw failure;
      });
      selectionBanks.set(descriptor.url, pending);
    }
    return (await pending).features.find((feature) => feature.id === id) ?? null;
  }
  const following = () => !destroyed && playing && labelsEnabled();
  function loop() {
    loopFrame = null;
    if (!following()) return;
    refresh();
    loopFrame = windowTarget.requestAnimationFrame(loop);
  }
  function syncLoop() {
    if (following() && loopFrame === null) loopFrame = windowTarget.requestAnimationFrame(loop);
    if (!following() && loopFrame !== null) {
      windowTarget.cancelAnimationFrame(loopFrame);
      loopFrame = null;
    }
  }
  function readLocal() {
    let chain = new windowTarget.DOMMatrix();
    for (let node = target; node && node !== scene; node = node.parentElement) {
      chain = new windowTarget.DOMMatrix(windowTarget.getComputedStyle(node).transform).multiply(chain);
    }
    return chain;
  }
  function hideAll() {
    for (const entry of entries) hideNow(entry);
    visible = /* @__PURE__ */ new Set();
    rects = /* @__PURE__ */ new Map();
    eligible = 0;
    matrix = null;
    picking.publish(root, []);
    presentCaption();
  }
  const onLabelsChange = () => {
    if (labelsEnabled()) {
      requestLoading();
      schedule();
    } else {
      hoveredIndex = null;
      hideAll();
    }
    syncLoop();
  };
  document.body.addEventListener("objectsurfacelabelschange", onLabelsChange);
  function refresh() {
    if (destroyed) return;
    frames++;
    const projection = view?.projection;
    const range = zoomRange();
    zoomGate = passesZoomGate(view?.zoom, range.minimum, range.maximum, plan.policy);
    const currentShare = view?.zoom === void 0 ? 0 : zoomShare(view.zoom, range.minimum, range.maximum);
    if (!labelsEnabled() || load.kind !== "loaded" || !enabled || !projection || !zoomGate && pinnedIndex === null || view !== null && view.levelOfDetail.stage !== "geometry") {
      hideAll();
      return;
    }
    requirePhysicalProjection(projection);
    local = readLocal();
    matrix = new windowTarget.DOMMatrix(Array.from(projection.eyeFromScene)).multiply(local).toFloat64Array();
    const width = host.clientWidth, height = host.clientHeight;
    const projectedEntries = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index], feature = entry.feature;
      if (!feature || (!zoomGate || feature.searchOnly || feature.minimumZoomShare > currentShare + 1e-6) && index !== pinnedIndex) continue;
      const projected = projectSurfaceFeature(feature, matrix, projection.focalPixels, projection.principalOffsetPixels);
      if (!projected) continue;
      entry.x = projected.x;
      entry.y = projected.y;
      projectedEntries.push({ index, kind: feature.kind, projected });
    }
    for (const { index } of projectedEntries) {
      const entry = entries[index];
      if (entry.measured) continue;
      entry.width = entry.element.offsetWidth;
      entry.height = entry.element.offsetHeight;
      entry.measured = true;
    }
    const candidates = projectedEntries.map(({ index, kind, projected }) => ({ index, kind, projected, width: entries[index].width, height: entries[index].height }));
    const budget = { ...plan.policy, maximumVisible: Math.max(4, Math.round(plan.policy.maximumVisible * (0.3 + 0.7 * currentShare))) };
    const admitted = admitSurfaceFeatureLabels(candidates, budget, { width, height }, visible, occlusion.read(), pinnedIndex);
    const next = /* @__PURE__ */ new Set(), nextRects = /* @__PURE__ */ new Map(), targets = [];
    for (const { index, rect, opacity } of admitted.accepted) {
      const entry = entries[index];
      next.add(index);
      nextRects.set(entry.feature.id, rect);
      const anchor = entry.feature.kind === "point" ? `translate(${format(entry.x + POINT_LABEL_GAP_PX)}px,${format(entry.y)}px) translate(0,-50%)` : `translate(${format(entry.x)}px,${format(entry.y)}px) translate(-50%,-50%)`;
      entry.element.style.transform = anchor;
      fadeTo(entry, opacity);
      targets.push({ element: entry.element, rank: SURFACE_PICK_RANK, shape: { kind: "rect", ...rect } });
    }
    for (let index = 0; index < entries.length; index++) if (!next.has(index) && (visible.has(index) || entries[index].targetOpacity > 0)) fadeTo(entries[index], 0);
    visible = next;
    rects = nextRects;
    eligible = admitted.eligible;
    picking.publish(root, targets);
    presentCaption();
  }
  function presentCaption() {
    const index = !labelsEnabled() ? null : pinnedIndex !== null && visible.has(pinnedIndex) ? pinnedIndex : hoveredIndex !== null && visible.has(hoveredIndex) ? hoveredIndex : null;
    if (index === null) {
      if (shownIndex !== null) {
        tooltip.hidden = true;
        delete tooltip.dataset.featureTooltipFor;
        delete root.dataset.featureOutlineFor;
        hideOutline();
        shownIndex = null;
      }
      return;
    }
    const entry = entries[index], feature = entry.feature;
    if (shownIndex !== index) {
      caption.show(feature);
      root.dataset.featureOutlineFor = feature.id;
      tooltip.hidden = false;
      shownIndex = index;
    }
    tooltip.dataset.featureTooltipPinned = pinnedIndex === index ? "true" : "false";
    const rect = rects.get(feature.id);
    tooltip.style.transform = `translate(${format((rect.left + rect.right) / 2)}px,${format(rect.top)}px) translate(-50%,-100%)`;
    presentOutline(feature);
  }
  function presentOutline(feature) {
    const projection = view?.projection;
    if (!matrix || !projection) {
      hideOutline();
      return;
    }
    const chords = projectSurfaceOutline(feature.outline, matrix, projection.focalPixels, projection.principalOffsetPixels, outline.length);
    chords.forEach((chord, index) => {
      const piece = outline[index];
      piece.style.transform = orbitSegmentTransform(chord);
      piece.style.visibility = "";
    });
    for (let index = chords.length; index < outline.length; index++) outline[index].style.visibility = "hidden";
    outlinePieces = chords.length;
  }
  async function selectIndex(index, signal) {
    const feature = entries[index]?.feature;
    if (!feature || destroyed || signal?.aborted) return { completed: false };
    pinnedIndex = index;
    flight?.cancel();
    flight = null;
    schedule();
    const frame = navigation.frame;
    const scenePoint = readLocal().transformPoint({ x: feature.normal[0], y: feature.normal[1], z: feature.normal[2], w: 0 });
    const length = Math.hypot(scenePoint.x, scenePoint.y, scenePoint.z);
    if (!(length > 0)) return { completed: false };
    const directionWorld = rotateWorldPosition(frame.presentationToReference, [scenePoint.x / length, scenePoint.y / length, scenePoint.z / length]);
    const optics = navigation.optics(), rect = optics.visibleRect;
    const shortSide = rect ? Math.min(rect.right - rect.left, rect.bottom - rect.top) : Math.min(host.clientWidth, host.clientHeight);
    const featureRadiusM = Math.max(MINIMUM_FRAMED_RADIUS_M, feature.radiusUnits / plan.meshRadiusUnits * frame.bodyRadiusM);
    const current = navigation.capture(), origin = frame.originM;
    const currentDistanceM = Math.hypot(current.pose.positionM[0] - origin[0], current.pose.positionM[1] - origin[1], current.pose.positionM[2] - origin[2]);
    const fitDistanceM = frame.bodyRadiusM + optics.focalPixels * featureRadiusM / (shortSide * ARRIVAL_DIAMETER_SHARE / 2);
    const minimumM = flightLimits().minimumDistanceM;
    const distanceM = Math.max(minimumM, Math.min(currentDistanceM, fitDistanceM));
    onFlight?.();
    const reducedMotion = typeof windowTarget.matchMedia === "function" && windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flight = flyToSurfaceDirection(navigation, { directionWorld, distanceM, reducedMotion, signal, windowTarget });
    const handle = flight;
    const result = await handle.done;
    if (flight === handle) flight = null;
    return result;
  }
  function clearSelection() {
    pinnedIndex = null;
    flight?.cancel();
    flight = null;
    presentCaption();
    schedule();
  }
  function hideOutline() {
    if (outlinePieces === 0) return;
    for (const piece of outline) piece.style.visibility = "hidden";
    outlinePieces = 0;
  }
  function fadeTo(entry, opacity) {
    if (entry.targetOpacity === opacity) {
      if (opacity > 0) entry.element.style.visibility = "";
      fader.set(entry.element, opacity, LABEL_FADE_MS);
      return;
    }
    if (entry.hideTimer !== null) {
      clearTimeout(entry.hideTimer);
      entry.hideTimer = null;
    }
    entry.targetOpacity = opacity;
    if (opacity > 0) entry.element.style.visibility = "";
    fader.set(entry.element, opacity, LABEL_FADE_MS);
    if (opacity === 0) entry.hideTimer = setTimeout(() => {
      entry.hideTimer = null;
      if (entry.targetOpacity === 0) entry.element.style.visibility = "hidden";
    }, LABEL_FADE_MS);
  }
  function hideNow(entry) {
    if (entry.hideTimer !== null) clearTimeout(entry.hideTimer);
    entry.hideTimer = null;
    entry.targetOpacity = 0;
    fader.set(entry.element, 0);
    entry.element.style.visibility = "hidden";
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (load.kind === "idle" || load.kind === "held") rejectLoaded(new DOMException("Surface feature loading was cancelled.", "AbortError"));
    controller.abort();
    flight?.cancel();
    flight = null;
    if (pendingFrame !== null) windowTarget.cancelAnimationFrame(pendingFrame);
    if (loopFrame !== null) windowTarget.cancelAnimationFrame(loopFrame);
    if (load.kind === "populating" && load.frame !== null) windowTarget.cancelAnimationFrame(load.frame);
    fonts?.removeEventListener("loadingdone", measure);
    pickingHost.removeEventListener("objecthoverchange", onHover);
    document.body.removeEventListener("objectsurfacelabelschange", onLabelsChange);
    windowTarget.removeEventListener("pointerdown", onPress, { capture: true });
    inputSurface.removeEventListener("wheel", onWheel);
    windowTarget.removeEventListener("click", onSurfaceClick);
    windowTarget.removeEventListener("keydown", onKey);
    entries.forEach((entry, index) => {
      entry.element.removeEventListener("click", activations[index]);
      if (entry.hideTimer !== null) clearTimeout(entry.hideTimer);
    });
    picking.remove(root);
    fader.destroy();
    root.remove();
  }
  return Object.freeze({
    root,
    lensIds: plan.lensIds,
    publish(next) {
      if (destroyed) return;
      view = next;
      schedule();
    },
    setLens({ id }) {
      if (destroyed) return;
      enabled = id !== null && plan.lensIds.includes(id);
      schedule();
    },
    setPlaying(value) {
      if (destroyed || playing === value) return;
      playing = value;
      syncLoop();
    },
    stats() {
      return Object.freeze({
        loaded: load.kind === "loaded",
        count: plan.catalog.count + (plan.selection?.count ?? 0),
        visible: visible.size,
        eligible,
        enabled,
        playing,
        frames,
        error: load.kind === "failed" ? load.error : null,
        zoomGate,
        outlinePieces,
        flying: flight !== null,
        hovered: hoveredIndex === null ? null : entries[hoveredIndex].feature?.id ?? null,
        pinned: pinnedIndex === null ? null : entries[pinnedIndex].feature?.id ?? null
      });
    },
    inspect() {
      return Object.freeze({ labels: Object.freeze(Object.fromEntries(entries.filter((entry) => entry.feature).map((entry) => [entry.feature.id, entry.element]))), tooltip, outline: Object.freeze([...outline]), rects });
    },
    catalog: () => load.kind === "populating" || load.kind === "loaded" ? load.catalog : null,
    loaded: () => {
      startLoading();
      return loadedCatalog;
    },
    setNavigationInFlight(active, landed = true) {
      navigationInFlight = active;
      if (active || load.kind !== "held") return;
      if (landed) startLoading();
      else load = { kind: "idle" };
    },
    async select(id, { signal } = {}) {
      if (signal?.aborted) return { completed: false };
      startLoading();
      await loadedCatalog;
      if (destroyed || signal?.aborted) return { completed: false };
      let index = entries.findIndex((entry) => entry.feature?.id === id);
      if (index < 0) {
        const feature = await selectionFeature(id);
        if (!feature || destroyed || signal?.aborted) return { completed: false };
        const entry = createEntry();
        populateEntry(entry, feature);
        entry.width = entry.element.offsetWidth;
        entry.height = entry.element.offsetHeight;
        entry.measured = true;
        index = entries.length - 1;
      }
      return selectIndex(index, signal);
    },
    selected: () => pinnedIndex === null ? null : entries[pinnedIndex].feature?.id ?? null,
    clear: clearSelection,
    destroy
  });
}

// src/renderers/css/navigation/camera-flight.ts
function createCameraFlight({ windowTarget, signal, paused = false, advance, onFinish = () => {
} }) {
  const controller = new AbortController();
  let frame = null, previousTime = null;
  let elapsedS = 0, speed = 1, settled = false, publishing = false;
  let resolve, reject;
  const finished = new Promise((done, fail2) => {
    resolve = done;
    reject = fail2;
  });
  void finished.catch(() => {
  });
  function settle(completed, failure, reason) {
    if (settled) return;
    settled = true;
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    frame = null;
    signal?.removeEventListener("abort", abort);
    try {
      onFinish(completed);
    } catch (error) {
      failure ??= { error };
    }
    if (failure) {
      controller.abort(failure.error);
      reject(failure.error);
    } else {
      if (!completed) controller.abort(reason);
      resolve({ completed });
    }
  }
  function cancel(reason = new DOMException("Camera flight was cancelled.", "AbortError")) {
    settle(false, void 0, reason);
  }
  function fail(error) {
    settle(false, { error });
  }
  function complete() {
    settle(true);
  }
  function abort() {
    cancel(signal?.reason);
  }
  function schedule() {
    if (!settled && !paused && !publishing && frame === null) frame = windowTarget.requestAnimationFrame(paint);
  }
  function accept(result, asynchronous) {
    publishing = false;
    if (settled) return;
    if (result === "complete") {
      complete();
      return;
    }
    if (asynchronous && result === "presented" && !paused) paint(windowTarget.performance.now());
    else schedule();
  }
  function paint(time) {
    frame = null;
    if (settled || paused) return;
    const stepS = previousTime === null ? 0 : Math.max(0, time - previousTime) / 1e3 * speed;
    previousTime = time;
    elapsedS += stepS;
    try {
      const result = advance(elapsedS, stepS);
      if (typeof result === "string") accept(result, false);
      else {
        publishing = true;
        void result.then((value) => accept(value, true), fail);
      }
    } catch (error) {
      fail(error);
    }
  }
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  else schedule();
  return Object.freeze({
    finished,
    signal: controller.signal,
    cancel,
    complete,
    /** Request the final sample, retaining the outstanding presentation acknowledgement. */
    finish() {
      if (settled) return;
      elapsedS = Infinity;
      paused = false;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
      if (!publishing) paint(windowTarget.performance.now());
    },
    hurry(multiplier) {
      speed = multiplier;
    },
    /** Hold at the acknowledged curve position while assets catch up. */
    hold(atElapsedS) {
      paused = true;
      elapsedS = atElapsedS;
      previousTime = null;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
    },
    resume() {
      paused = false;
      schedule();
    }
  });
}

// src/renderers/css/navigation/camera-motion.ts
function createCameraMotion() {
  let active = null;
  const motion = Object.freeze({
    get signal() {
      return active?.flight?.signal;
    },
    owns(signal) {
      return active?.sourceSignal === signal;
    },
    cancel(signal) {
      if (signal && !motion.owns(signal)) return;
      const owner = active;
      active = null;
      owner?.flight?.cancel();
    },
    /** Destination input accelerates arrival; other input can take over. */
    hurryForInput() {
      if (!active?.inputSpeedUp || !active.flight) return false;
      active.flight.hurry(active.inputSpeedUp);
      return true;
    },
    arrive() {
      if (active?.inputSpeedUp) active.flight?.finish();
    },
    start(options) {
      const previous = active, owner = { sourceSignal: options.signal, inputSpeedUp: options.inputSpeedUp };
      active = owner;
      previous?.flight?.cancel();
      const flight = createCameraFlight({ ...options, onFinish(completed) {
        if (active === owner) active = null;
        options.onFinish?.(completed);
      } });
      owner.flight = flight;
      if (active !== owner) flight.cancel();
      return flight;
    },
    fly({ windowTarget, sample, durationMilliseconds, signal, inputSpeedUp, onFinish }) {
      if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 0) throw new TypeError("Invalid camera flight duration.");
      const clock = createOpacityClock(windowTarget);
      const flight = motion.start({ signal, inputSpeedUp, windowTarget: {
        requestAnimationFrame: (callback) => clock.request(callback, "input"),
        cancelAnimationFrame: (id) => clock.cancel(id),
        performance: { now: clock.now }
      }, onFinish(completed) {
        clock.destroy();
        onFinish?.(completed);
      }, advance(elapsedS) {
        const progress = durationMilliseconds === 0 ? 1 : Math.min(1, elapsedS * 1e3 / durationMilliseconds);
        const acknowledge = (shown = true) => !shown || flight.signal.aborted ? "idle" : progress === 1 ? "complete" : "presented";
        const publication = sample(progress, flight.signal);
        return publication && typeof publication.then === "function" ? publication.then(acknowledge) : acknowledge();
      } });
      if (durationMilliseconds === 0) flight.finish();
      return flight;
    }
  });
  return motion;
}
export {
  createCameraMotion,
  mountSurfaceFeatureLabels
};
