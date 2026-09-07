import type { LegacyCameraPose, PhysicalCameraPose } from './types.js';
type ScalarKey = 'altitudeM' | 'distanceM' | 'azimuthRad' | 'polarRad' | 'orbitRollRad' | 'epochUnixMs' | 'timeScale' | 'fovDeg';
export interface ViewParameters extends Partial<Record<ScalarKey, number>> { lookMode?: 'orbit' | 'freeLook'; lookQuaternionXyzw?: readonly number[]; panM?: readonly number[]; hiddenLayers?: readonly string[]; }
export interface SharedPlayback { times: readonly number[]; speed: number; motionRequested: boolean; }
export interface LegacySharedCamera { controlPitch: number; controlYaw: number; zoom: number; distanceKilometers?: number; pose: LegacyCameraPose; }
export interface PhysicalSharedCamera { distanceKilometers: number; pose: PhysicalCameraPose; bodyCenterKilometers?: readonly [number, number, number]; }
export interface SharedView { camera: LegacySharedCamera | PhysicalSharedCamera; playback: SharedPlayback; preparedEpochJdTt?: number | null; }
function isPhysicalCamera(camera: SharedView['camera']): camera is PhysicalSharedCamera { return camera.pose.schema === 'cssearth-camera-pose@2'; }
// Galaxio view URL version 1: the field order, defaults and big-endian
// float64 payload are the wire contract, independent of the scene adapter.
export const VIEW_LAYERS = Object.freeze(["rings", "atmospheres", "bodies", "milky-way", "deep-sky", "galaxies"]);
const MAX_ANGLE_RAD = 1e6 * Math.PI / 180;
const SCALARS: readonly [ScalarKey, number, number, number | undefined][] = [
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
function invalid(key = "v"): never { throw new Error(`Invalid “${key}” in this view link.`); };

function bounded(value: unknown, key: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) invalid(key);
}

function validate(view: ViewParameters) {
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

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function formatViewParameters(view: ViewParameters) {
  validate(view);
  const bytes = new Uint8Array(MAX_BYTES), data = new DataView(bytes.buffer);
  let offset = 2, flags = VERSION << 12;
  if (view.lookMode === "freeLook") flags |= FREE_LOOK;
  const write = (value: number) => { data.setFloat64(offset, value); offset += 8; };
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

export function parseViewParameters(search: string): ViewParameters {
  const query = new URLSearchParams(search);
  if (query.size === 0) return {};
  if (query.size !== 1 || !query.has("v")) invalid();
  const token = query.get("v");
  if (token === null) invalid();
  if (!/^[A-Za-z0-9_-]{3,154}$/u.test(token) || token.length % 4 === 1) invalid();
  const bytes = Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
  if (bytes.length > MAX_BYTES || base64url(bytes) !== token) invalid();
  const data = new DataView(bytes.buffer), flags = data.getUint16(0);
  if ((flags & VERSION_MASK) >>> 12 !== VERSION) throw new Error("This view link uses an unsupported version.");
  const result: ViewParameters = {};
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

const SHARED_VERSION = 2;
const LEGACY_SHARED_VERSION = 1;
const MAX_SHARED_BYTES = 4096;
const SHARED_POSE_SCHEMA = "cssearth-camera-pose@1";
const MINIMAL_POSE_SCHEMA = "cssearth-camera-pose@2";
const POSE_FIELDS = ["scene", "skybox", "sunView"] as const;
const MATRIX_INDICES = [0, 1, 2, 4, 5, 6, 8, 9, 10];

function record(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) invalid(label);
}

function poseMatrix(value: unknown) {
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
  return matrix;
}

function validateShared(view: unknown): asserts view is SharedView {
  record(view, ["camera", "preparedEpochJdTt", "playback"], "view");
  const camera = view.camera, playback = view.playback;
  record(camera, ["controlPitch", "controlYaw", "zoom", "distanceKilometers", "pose", "bodyCenterKilometers"], "camera");
  const pose = camera.pose;
  record(pose, ["schema", "scene", "skybox", "sunView"], "pose");
  const minimal = pose.schema === MINIMAL_POSE_SCHEMA;
  if (minimal) {
    record(camera, ["distanceKilometers", "pose", "bodyCenterKilometers"], "camera");
    if (typeof camera.distanceKilometers !== "number" || !Number.isFinite(camera.distanceKilometers) || camera.distanceKilometers <= 0) invalid("camera");
    if (camera.bodyCenterKilometers !== undefined) {
      const centre = camera.bodyCenterKilometers;
      if (!Array.isArray(centre) || centre.length !== 3 || ![0, 1, 2].every(index => typeof centre[index] === 'number' && Number.isFinite(centre[index])) ||
          Math.abs(Math.hypot(...centre) - camera.distanceKilometers) > camera.distanceKilometers * 1e-12) invalid('camera');
    }
    record(pose, ["schema", "scene"], "pose");
  } else {
    if (camera.bodyCenterKilometers !== undefined) invalid('camera');
    if (typeof camera.controlPitch !== "number" || typeof camera.controlYaw !== "number" || typeof camera.zoom !== "number" ||
      ![camera.controlPitch, camera.controlYaw, camera.zoom].every(Number.isFinite) || camera.zoom <= 0 ||
      (camera.distanceKilometers !== undefined && (typeof camera.distanceKilometers !== "number" || !Number.isFinite(camera.distanceKilometers) || camera.distanceKilometers <= 0))) invalid("camera");
  }
  if (pose.schema !== (minimal ? MINIMAL_POSE_SCHEMA : SHARED_POSE_SCHEMA)) invalid("pose");
  for (const field of minimal ? ["scene"] : POSE_FIELDS) poseMatrix(pose[field]);
  if (view.preparedEpochJdTt !== undefined && view.preparedEpochJdTt !== null &&
    (typeof view.preparedEpochJdTt !== "number" || !Number.isFinite(view.preparedEpochJdTt))) invalid("preparedEpochJdTt");
  record(playback, ["times", "speed", "motionRequested"], "playback");
  if (!Array.isArray(playback.times) || typeof playback.speed !== "number" || !Number.isFinite(playback.speed) || playback.speed < 0 || typeof playback.motionRequested !== "boolean") invalid("playback");
  for (const time of playback.times) if (typeof time !== "number" || !Number.isFinite(time) || time < 0) invalid("playback");
}

export function formatSharedView(view: SharedView) {
  validateShared(view);
  const camera = view.camera;
  if (isPhysicalCamera(camera)) return formatMinimalShared(view, camera);
  const pose = camera.pose, playback = view.playback;
  // Pick the pose explicitly: camera.state() deliberately makes it
  // nonenumerable. Astronomical TT metadata stays separate from WAAPI time.
  let flags = SHARED_VERSION << 12;
  const values = [camera.controlPitch, camera.controlYaw, camera.zoom];
  if (camera.distanceKilometers !== undefined) { flags |= 1; values.push(camera.distanceKilometers); }
  if (view.preparedEpochJdTt !== undefined) {
    flags |= 2;
    if (view.preparedEpochJdTt !== null) { flags |= 4; values.push(view.preparedEpochJdTt); }
  }
  if (playback.speed !== 1) { flags |= 8; values.push(playback.speed); }
  if (playback.motionRequested) flags |= 16;
  for (const [index, field] of POSE_FIELDS.entries()) {
    const matrix = poseMatrix(pose[field]), quaternion = matrixQuaternion(matrix);
    const reconstructed = quaternionMatrix(quaternion);
    // Prepared registrations can contain rounded, slightly nonorthogonal
    // values. Keep those nine components exactly instead of normalizing them.
    if (MATRIX_INDICES.some(i => Math.abs(matrix[i] - reconstructed[i]) > 1e-12)) {
      flags |= 1 << (5 + index);
      values.push(...MATRIX_INDICES.map(i => matrix[i]));
    } else values.push(...quaternion);
  }
  const length = 4 + 8 * (values.length + playback.times.length);
  if (length > MAX_SHARED_BYTES) invalid();
  const bytes = new Uint8Array(length), data = new DataView(bytes.buffer);
  data.setUint16(0, flags);
  let offset = 2;
  for (const value of values) { data.setFloat64(offset, value); offset += 8; }
  data.setUint16(offset, playback.times.length); offset += 2;
  for (const time of playback.times) { data.setFloat64(offset, time); offset += 8; }
  return `v=${base64url(bytes)}`;
}

export function parseSharedView(search: string): SharedView | null {
  const query = new URLSearchParams(search);
  if (query.size === 0) return null;
  if (query.size !== 1 || !query.has("v")) invalid();
  const token = query.get("v");
  if (token === null) invalid();
  if (!/^[A-Za-z0-9_-]+$/u.test(token) || token.length < 3 || token.length > Math.ceil(MAX_SHARED_BYTES * 4 / 3) || token.length % 4 === 1) invalid();
  let bytes;
  try {
    bytes = Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
    if (bytes.length > MAX_SHARED_BYTES || base64url(bytes) !== token) invalid();
  } catch { invalid(); }
  return bytes[0] === 0x7b ? parseLegacyShared(bytes) : parseBinaryShared(bytes);
}

function parseLegacyShared(bytes: Uint8Array): SharedView {
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { invalid(); }
  record(payload, ["v", "c", "p", "e"], "view");
  if (payload.v !== LEGACY_SHARED_VERSION) throw new Error("This shared view link uses an unsupported version.");
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

function parseBinaryShared(bytes: Uint8Array): SharedView {
  if (bytes.length < 2) invalid();
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), flags = data.getUint16(0);
  if (flags >>> 12 === 3 || flags >>> 12 === 4) return parseMinimalShared(bytes);
  if (flags >>> 12 !== SHARED_VERSION) throw new Error("This shared view link uses an unsupported version.");
  if (flags & 0x0f00 || (flags & 6) === 4) invalid();
  let offset = 2;
  const read = () => {
    if (offset + 8 > bytes.length) invalid();
    const value = data.getFloat64(offset); offset += 8;
    if (!Number.isFinite(value)) invalid();
    return value;
  };
  const camera: Partial<LegacySharedCamera> = { controlPitch: read(), controlYaw: read(), zoom: read() };
  if (flags & 1) camera.distanceKilometers = read();
  const view: { camera: Partial<LegacySharedCamera>; preparedEpochJdTt?: number | null; playback?: SharedPlayback } = { camera };
  if (flags & 2) view.preparedEpochJdTt = flags & 4 ? read() : null;
  const speed = flags & 8 ? read() : 1;
  camera.pose = { schema: SHARED_POSE_SCHEMA, scene: "", skybox: "", sunView: "" };
  for (const [index, field] of POSE_FIELDS.entries()) {
    let matrix;
    if (flags & (1 << (5 + index))) {
      matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
      for (const component of MATRIX_INDICES) matrix[component] = read();
    } else {
      const quaternion = [read(), read(), read(), read()];
      if (quaternion.some(value => Math.abs(value) > 1) || Math.abs(Math.hypot(...quaternion) - 1) > 1e-12) invalid("pose");
      matrix = quaternionMatrix(quaternion);
    }
    camera.pose[field] = serializeMatrix(matrix);
  }
  if (offset + 2 > bytes.length) invalid();
  const count = data.getUint16(offset); offset += 2;
  if (offset + count * 8 !== bytes.length) invalid();
  view.playback = { times: Array.from({ length: count }, read), speed, motionRequested: Boolean(flags & 16) };
  validateShared(view);
  return view;
}

function formatMinimalShared(view: SharedView, camera: PhysicalSharedCamera) {
  let flags = (camera.bodyCenterKilometers ? 4 : 3) << 12;
  const values = camera.bodyCenterKilometers ? [...camera.bodyCenterKilometers] : [camera.distanceKilometers], playback = view.playback;
  if (view.preparedEpochJdTt !== undefined) {
    flags |= 2;
    if (view.preparedEpochJdTt !== null) { flags |= 4; values.push(view.preparedEpochJdTt); }
  }
  if (playback.speed !== 1) { flags |= 8; values.push(playback.speed); }
  if (playback.motionRequested) flags |= 16;
  const matrix = poseMatrix(view.camera.pose.scene), quaternion = matrixQuaternion(matrix);
  let largest = 0;
  for (let i = 1; i < 4; i += 1) if (Math.abs(quaternion[i]) > Math.abs(quaternion[largest])) largest = i;
  const sign = quaternion[largest] < 0 ? -1 : 1;
  const small = quaternion.filter((_, i) => i !== largest).map(value => value * sign);
  const reconstructed = quaternionMatrix(expandQuaternion(small, largest));
  if (MATRIX_INDICES.some(i => Math.abs(matrix[i] - reconstructed[i]) > 1e-12)) {
    flags |= 32;
    values.push(...MATRIX_INDICES.map(i => matrix[i]));
  } else { flags |= largest << 6; values.push(...small); }
  const length = 4 + 8 * (values.length + playback.times.length);
  if (length > MAX_SHARED_BYTES) invalid();
  const bytes = new Uint8Array(length), data = new DataView(bytes.buffer);
  data.setUint16(0, flags);
  let offset = 2;
  for (const value of values) { data.setFloat64(offset, value); offset += 8; }
  data.setUint16(offset, playback.times.length); offset += 2;
  for (const time of playback.times) { data.setFloat64(offset, time); offset += 8; }
  return `v=${base64url(bytes)}`;
}

function parseMinimalShared(bytes: Uint8Array): SharedView {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), flags = data.getUint16(0);
  if (flags & 0x0f01 || (flags & 6) === 4 || (flags & 32 && flags & 0xc0)) invalid();
  let offset = 2;
  const read = () => {
    if (offset + 8 > bytes.length) invalid();
    const value = data.getFloat64(offset); offset += 8;
    if (!Number.isFinite(value)) invalid();
    return value;
  };
  const bodyCenterKilometers: readonly [number, number, number] | undefined = flags >>> 12 === 4 ? [read(), read(), read()] : undefined;
  const view: { camera: Partial<PhysicalSharedCamera>; preparedEpochJdTt?: number | null; playback?: SharedPlayback } = {
    camera: bodyCenterKilometers ? { distanceKilometers: Math.hypot(...bodyCenterKilometers), bodyCenterKilometers } : { distanceKilometers: read() },
  };
  if (flags & 2) view.preparedEpochJdTt = flags & 4 ? read() : null;
  const speed = flags & 8 ? read() : 1;
  let matrix;
  if (flags & 32) {
    matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    for (const index of MATRIX_INDICES) matrix[index] = read();
  } else matrix = quaternionMatrix(expandQuaternion([read(), read(), read()], (flags >> 6) & 3));
  view.camera.pose = { schema: MINIMAL_POSE_SCHEMA, scene: serializeMatrix(matrix) };
  if (offset + 2 > bytes.length) invalid();
  const count = data.getUint16(offset); offset += 2;
  if (offset + count * 8 !== bytes.length) invalid();
  view.playback = { times: Array.from({ length: count }, read), speed, motionRequested: Boolean(flags & 16) };
  validateShared(view);
  return view;
}

function expandQuaternion(small: readonly number[], largest: number) {
  const sum = small.reduce((total, value) => total + value * value, 0);
  if (!Number.isFinite(sum) || sum > 0.75 + 1e-12) invalid("pose");
  const omitted = Math.sqrt(1 - sum);
  if (small.some(value => Math.abs(value) > omitted + 1e-12)) invalid("pose");
  const quaternion = [...small]; quaternion.splice(largest, 0, omitted);
  return quaternion;
}

function serializeMatrix(matrix: readonly number[]) {
  return `matrix3d(${matrix.map(value => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(",")})`;
}

function quaternionMatrix([x, y, z, w]: readonly number[]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1];
}

function matrixQuaternion(m: readonly number[]) {
  const trace = m[0] + m[5] + m[10];
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = s / 4; x = (m[6] - m[9]) / s; y = (m[8] - m[2]) / s; z = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2;
    w = (m[6] - m[9]) / s; x = s / 4; y = (m[4] + m[1]) / s; z = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2;
    w = (m[8] - m[2]) / s; x = (m[4] + m[1]) / s; y = s / 4; z = (m[9] + m[6]) / s;
  } else {
    const s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2;
    w = (m[1] - m[4]) / s; x = (m[8] + m[2]) / s; y = (m[9] + m[6]) / s; z = s / 4;
  }
  const norm = Math.hypot(x, y, z, w);
  return [x / norm, y / norm, z / norm, w / norm];
}
