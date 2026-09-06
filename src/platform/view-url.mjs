// Galaxio view URL version 1: the field order, defaults and big-endian
// float64 payload are the wire contract, independent of the scene adapter.
export const VIEW_LAYERS = Object.freeze(["rings", "atmospheres", "bodies", "milky-way", "deep-sky", "galaxies"]);
const MAX_ANGLE_RAD = 1e6 * Math.PI / 180;
const SCALARS = [
  ["altitudeM", 10 ** Math.log10(0.1), 10 ** Math.log10(4.4e26), undefined],
  ["distanceM", 10 ** Math.log10(0.1), 10 ** Math.log10(4.4e26), undefined],
  ["azimuthRad", -MAX_ANGLE_RAD, MAX_ANGLE_RAD, 0],
  ["polarRad", Math.PI / 2 - MAX_ANGLE_RAD, Math.PI / 2 + MAX_ANGLE_RAD, Math.PI / 2],
  ["orbitRollRad", -MAX_ANGLE_RAD, MAX_ANGLE_RAD, 0],
  ["epochUnixMs", -62167219200000, 253402300799999, undefined],
  ["timeScale", -1e9, 1e9, 1],
  ["fovDeg", 1, 170, 85],
];
const VERSION = 1, VERSION_MASK = 0x7000;
const FREE_LOOK = 1 << 15, LOOK = 1 << 8, PAN = 1 << 9, HIDDEN = 1 << 10, PAUSED = 1 << 11;
const MAX_BYTES = 115;
const invalid = (key = "v") => { throw new Error(`Invalid “${key}” in this view link.`); };

function bounded(value, key, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) invalid(key);
}

function validate(view) {
  if (view.lookMode !== undefined && view.lookMode !== "orbit" && view.lookMode !== "freeLook") invalid("lookMode");
  if (view.lookMode === "freeLook" && view.lookQuaternionXyzw === undefined) invalid("look");
  if (view.altitudeM !== undefined && view.distanceM !== undefined) invalid("distanceM");
  for (const [key, minimum, maximum] of SCALARS) {
    if (view[key] !== undefined) bounded(view[key], key, minimum, maximum);
  }
  if (view.lookQuaternionXyzw !== undefined) {
    const values = view.lookQuaternionXyzw;
    if (values.length !== 4) invalid("look");
    for (const value of values) bounded(value, "look", -1, 1);
    if (Math.abs(Math.hypot(...values) - 1) > 1e-6) invalid("look");
  }
  if (view.panM !== undefined) {
    if (view.panM.length !== 3) invalid("pan");
    for (const value of view.panM) bounded(value, "pan", -1e27, 1e27);
  }
  if (view.hiddenLayers !== undefined && (new Set(view.hiddenLayers).size !== view.hiddenLayers.length ||
      view.hiddenLayers.some(layer => !VIEW_LAYERS.includes(layer)))) invalid("hide");
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function formatViewParameters(view) {
  validate(view);
  const bytes = new Uint8Array(MAX_BYTES), data = new DataView(bytes.buffer);
  let offset = 2, flags = VERSION << 12;
  if (view.lookMode === "freeLook") flags |= FREE_LOOK;
  const write = value => { data.setFloat64(offset, value); offset += 8; };
  for (const [index, [key, , , defaultValue]] of SCALARS.entries()) {
    const value = view[key];
    if (value === undefined || value === defaultValue) continue;
    if (key === "timeScale" && value === 0) { flags |= PAUSED; continue; }
    flags |= 1 << index;
    write(value);
  }
  if (view.lookQuaternionXyzw) {
    flags |= LOOK;
    view.lookQuaternionXyzw.forEach(write);
  }
  if (view.panM?.some(value => value !== 0)) {
    flags |= PAN;
    view.panM.forEach(write);
  }
  if (view.hiddenLayers?.length) {
    flags |= HIDDEN;
    bytes[offset++] = view.hiddenLayers.reduce((mask, layer) => mask | (1 << VIEW_LAYERS.indexOf(layer)), 0);
  }
  data.setUint16(0, flags);
  return `v=${base64url(bytes.subarray(0, offset))}`;
}

export function parseViewParameters(search) {
  const query = new URLSearchParams(search);
  if (query.size === 0) return {};
  if (query.size !== 1 || !query.has("v")) invalid();
  const token = query.get("v");
  if (!/^[A-Za-z0-9_-]{3,154}$/u.test(token) || token.length % 4 === 1) invalid();
  const bytes = Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
  if (bytes.length > MAX_BYTES || base64url(bytes) !== token) invalid();
  const data = new DataView(bytes.buffer), flags = data.getUint16(0);
  if ((flags & VERSION_MASK) >>> 12 !== VERSION) throw new Error("This view link uses an unsupported version.");
  const result = {};
  if (flags & FREE_LOOK) result.lookMode = "freeLook";
  let offset = 2;
  const read = () => {
    if (offset + 8 > bytes.length) invalid();
    const value = data.getFloat64(offset);
    offset += 8;
    return value;
  };
  for (const [index, [key, , , defaultValue]] of SCALARS.entries()) {
    if (flags & (1 << index)) result[key] = read();
    else if (defaultValue !== undefined) result[key] = defaultValue;
  }
  if (flags & PAUSED) {
    if (flags & (1 << 6)) invalid("timeScale");
    result.timeScale = 0;
  }
  if (flags & LOOK) result.lookQuaternionXyzw = [read(), read(), read(), read()];
  if (flags & PAN) result.panM = [read(), read(), read()];
  if (flags & HIDDEN) {
    if (offset >= bytes.length) invalid("hide");
    const mask = bytes[offset++];
    if (mask >> VIEW_LAYERS.length) invalid("hide");
    result.hiddenLayers = VIEW_LAYERS.filter((_, index) => mask & (1 << index));
  }
  if (offset !== bytes.length) invalid();
  validate(result);
  return result;
}

const SHARED_VERSION = 1;
const MAX_SHARED_BYTES = 4096;
const SHARED_POSE_SCHEMA = "cssearth-camera-pose@1";

function record(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) invalid(label);
}

function poseMatrix(value) {
  if (typeof value !== "string" || value.length > 1024) invalid("pose");
  const match = /^matrix3d\(([^)]+)\)$/u.exec(value);
  if (!match) invalid("pose");
  const fields = match[1].split(",").map(field => field.trim());
  if (fields.length !== 16 || fields.some(field => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(field))) invalid("pose");
  const matrix = fields.map(Number);
  if (!matrix.every(Number.isFinite) || [3, 7, 11, 12, 13, 14].some(index => Math.abs(matrix[index]) > 1e-9) ||
      Math.abs(matrix[15] - 1) > 1e-9) invalid("pose");
  // The saved values are rotations, rounded by the live CSS serializer.
  for (let a = 0; a < 3; a += 1) for (let b = a; b < 3; b += 1) {
    const dot = matrix[a * 4] * matrix[b * 4] + matrix[a * 4 + 1] * matrix[b * 4 + 1] + matrix[a * 4 + 2] * matrix[b * 4 + 2];
    if (Math.abs(dot - (a === b ? 1 : 0)) > 1e-4) invalid("pose");
  }
  const determinant = matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[2] * matrix[9]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[2] * matrix[5]);
  if (Math.abs(determinant - 1) > 1e-4) invalid("pose");
}

function validateShared(view) {
  record(view, ["camera", "preparedEpochJdTt", "playback"], "view");
  const camera = view.camera, playback = view.playback;
  record(camera, ["controlPitch", "controlYaw", "zoom", "distanceKilometers", "pose"], "camera");
  if (![camera.controlPitch, camera.controlYaw, camera.zoom].every(Number.isFinite) || !(camera.zoom > 0) ||
      (camera.distanceKilometers !== undefined && (!Number.isFinite(camera.distanceKilometers) || !(camera.distanceKilometers > 0)))) invalid("camera");
  record(camera.pose, ["schema", "scene", "skybox", "sunView"], "pose");
  if (camera.pose.schema !== SHARED_POSE_SCHEMA) invalid("pose");
  for (const field of ["scene", "skybox", "sunView"]) poseMatrix(camera.pose[field]);
  if (view.preparedEpochJdTt !== undefined && view.preparedEpochJdTt !== null && !Number.isFinite(view.preparedEpochJdTt)) invalid("preparedEpochJdTt");
  record(playback, ["times", "speed", "motionRequested"], "playback");
  if (!Array.isArray(playback.times) || !Number.isFinite(playback.speed) || playback.speed < 0 || typeof playback.motionRequested !== "boolean") invalid("playback");
  for (const time of playback.times) if (!Number.isFinite(time) || time < 0) invalid("playback");
}

export function formatSharedView(view) {
  validateShared(view);
  const camera = view.camera, pose = camera.pose, playback = view.playback;
  // Pick the pose explicitly: camera.state() deliberately makes it
  // nonenumerable. Astronomical TT metadata stays separate from WAAPI time.
  const payload = { v: SHARED_VERSION,
    c: [camera.controlPitch, camera.controlYaw, camera.zoom, camera.distanceKilometers ?? null, pose.scene, pose.skybox, pose.sunView],
    p: [playback.times, playback.speed, playback.motionRequested],
    ...(view.preparedEpochJdTt === undefined ? {} : { e: view.preparedEpochJdTt }) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.length > MAX_SHARED_BYTES) invalid();
  return `v=${base64url(bytes)}`;
}

export function parseSharedView(search) {
  const query = new URLSearchParams(search);
  if (query.size === 0) return null;
  if (query.size !== 1 || !query.has("v")) invalid();
  const token = query.get("v");
  if (!/^[A-Za-z0-9_-]+$/u.test(token) || token.length < 3 || token.length > Math.ceil(MAX_SHARED_BYTES * 4 / 3) || token.length % 4 === 1) invalid();
  let bytes, payload;
  try {
    bytes = Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
    if (bytes.length > MAX_SHARED_BYTES || base64url(bytes) !== token) invalid();
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { invalid(); }
  record(payload, ["v", "c", "p", "e"], "view");
  if (payload.v !== SHARED_VERSION) throw new Error("This shared view link uses an unsupported version.");
  if (!Array.isArray(payload.c) || payload.c.length !== 7 || !Array.isArray(payload.p) || payload.p.length !== 3) invalid();
  const [controlPitch, controlYaw, zoom, distanceKilometers, scene, skybox, sunView] = payload.c;
  const [times, speed, motionRequested] = payload.p;
  const view = { camera: { controlPitch, controlYaw, zoom,
    ...(distanceKilometers === null ? {} : { distanceKilometers }),
    pose: { schema: SHARED_POSE_SCHEMA, scene, skybox, sunView } },
    playback: { times, speed, motionRequested },
    ...(Object.hasOwn(payload, "e") ? { preparedEpochJdTt: payload.e } : {}) };
  validateShared(view);
  return view;
}
