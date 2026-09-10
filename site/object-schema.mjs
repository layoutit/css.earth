const OBJECT_INPUT_KEYS = new Set([
  "id",
  "name",
  "systemName",
  "classification",
  "color",
  "distanceAu",
  "route",
  "loadScene",
  "description",
  "worldFrame",
]);

// Classification vocabulary, not a registry of object identities. Extend this
// list deliberately when a package introduces a new kind of body.
export const OBJECT_CLASSIFICATIONS = Object.freeze([
  "star", "planet", "satellite", "dwarf-planet", "asteroid", "trans-neptunian", "comet",
]);

export function defineObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Object definition must be an object.");
  }
  const unsupported = Object.keys(input).filter((key) =>
    !OBJECT_INPUT_KEYS.has(key));
  if (unsupported.length > 0) {
    throw new TypeError(`Unsupported object field: ${unsupported.join(", ")}.`);
  }

  const { id, name, systemName, classification, color, distanceAu, route, loadScene, description, worldFrame = null } = input;
  if (!safeId(id) || !nonEmpty(name) || !nonEmpty(systemName) || !OBJECT_CLASSIFICATIONS.includes(classification) ||
      !/^#[0-9a-f]{6}$/u.test(color ?? "") ||
      !Number.isFinite(distanceAu) || distanceAu < 0 ||
      route !== `/${id}/` || typeof loadScene !== "function" ||
      !nonEmpty(description)) {
    throw new TypeError(`Invalid object definition: ${id ?? "unknown"}.`);
  }

  return Object.freeze({
    id,
    name,
    systemName,
    classification,
    color,
    distanceAu,
    route,
    loadScene,
    description,
    worldFrame: parseWorldFrame(worldFrame),
  });
}

export function defineObjects(objects) {
  if (!Array.isArray(objects) || objects.length === 0) {
    throw new TypeError("Object registry must contain at least one object.");
  }
  const ids = new Set();
  const routes = new Set();
  for (const object of objects) {
    if (ids.has(object.id) || routes.has(object.route)) {
      throw new TypeError(`Duplicate object definition: ${object.id}.`);
    }
    ids.add(object.id);
    routes.add(object.route);
  }
  return Object.freeze([...objects]);
}

function safeId(value) {
  return /^[a-z][a-z0-9-]*$/u.test(value ?? "");
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}
// Registry capability data is numeric; importing a renderer entry here would
// pull its native camera factory into every otherwise unrelated object route.
function parseWorldFrame(value) {
  if (value === null || value === undefined) return null;
  const fields = ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'metersPerUnit', 'bodyRadiusM', 'orbitUpReference'];
  const vector = (input, length) => Array.isArray(input) && input.length === length && Array.from(input).every(Number.isFinite);
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(key => !fields.includes(key)) ||
      !nonEmpty(value.referenceFrame) || !Number.isFinite(value.epochJdTt) || !vector(value.originM, 3) ||
      !vector(value.presentationToReference, 9) || !Number.isFinite(value.metersPerUnit) || value.metersPerUnit <= 0 ||
      !Number.isFinite(value.bodyRadiusM) || value.bodyRadiusM <= 0) throw new TypeError('Invalid prepared world frame.');
  const rotation = value.presentationToReference;
  for (let row = 0; row < 3; row++) for (let other = 0; other < 3; other++) {
    let dot = 0;
    for (let column = 0; column < 3; column++) dot += rotation[row * 3 + column] * rotation[other * 3 + column];
    if (Math.abs(dot - Number(row === other)) > 1e-9) throw new TypeError('World frame rotation must be orthonormal.');
  }
  const [a, b, c, d, e, f, g, h, i] = rotation;
  if (Math.abs(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) - 1) > 1e-9) {
    throw new TypeError('World frame rotation must preserve handedness.');
  }
  if (value.orbitUpReference !== undefined && (!vector(value.orbitUpReference, 3) ||
      Math.abs(Math.hypot(...value.orbitUpReference) - 1) > 1e-9)) {
    throw new TypeError('Orbit up must be a unit vector.');
  }
  return Object.freeze({ referenceFrame: value.referenceFrame, epochJdTt: value.epochJdTt,
    originM: Object.freeze([...value.originM]), presentationToReference: Object.freeze([...rotation]),
    metersPerUnit: value.metersPerUnit, bodyRadiusM: value.bodyRadiusM,
    ...(value.orbitUpReference === undefined ? {} : { orbitUpReference: Object.freeze([...value.orbitUpReference]) }) });
}
