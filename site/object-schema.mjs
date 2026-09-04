const OBJECT_INPUT_KEYS = new Set([
  "id",
  "name",
  "color",
  "distanceAu",
  "route",
  "loadScene",
  "description",
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

  const { id, name, color, distanceAu, route, loadScene, description } = input;
  if (!safeId(id) || !nonEmpty(name) ||
      !/^#[0-9a-f]{6}$/u.test(color ?? "") ||
      !Number.isFinite(distanceAu) || distanceAu < 0 ||
      route !== `/${id}/` || typeof loadScene !== "function" ||
      !nonEmpty(description)) {
    throw new TypeError(`Invalid object definition: ${id ?? "unknown"}.`);
  }

  return Object.freeze({
    id,
    name,
    color,
    distanceAu,
    route,
    loadScene,
    description,
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
