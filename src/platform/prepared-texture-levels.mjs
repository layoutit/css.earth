// Shared by offline qualification and the browser's external JSON boundary.
export function requireTextureLevels(value, variants, resources) {
  const fail = () => { throw new TypeError('Invalid prepared texture levels.'); };
  const record = (value, fields) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || fields && Object.keys(value).some(key => !fields.includes(key))) fail();
    return value;
  };
  const plan = record(value, ['hysteresis', 'levels']);
  if (!Number.isFinite(plan.hysteresis) || plan.hysteresis < 0 || plan.hysteresis >= 1 ||
      !Array.isArray(plan.levels) || plan.levels.length < 2 || plan.levels.length > 8) fail();
  const textures = new Set(variants.flatMap(variant => variant.writes.filter(write => write.kind === 'texture').map(write => write.resource)));
  let previous = -1, addresses;
  for (const [i, input] of plan.levels.entries()) {
    const level = record(input, ['minimumDiameter', 'resources']);
    if (!Number.isFinite(level.minimumDiameter) || level.minimumDiameter <= previous || i === 0 && level.minimumDiameter !== 0) fail();
    previous = level.minimumDiameter;
    const mapping = record(level.resources), keys = Object.keys(mapping).sort();
    if (!keys.length || addresses && (keys.length !== addresses.length || keys.some((key, i) => key !== addresses[i]))) fail();
    addresses = keys;
    for (const [source, target] of Object.entries(mapping)) {
      if (!textures.has(source) || !resources.has(source) || typeof target !== 'string' || !resources.has(target)) fail();
      if (i === plan.levels.length - 1 && target !== source) fail();
      if (variants.some(variant => variant.writes.some(write => write.kind === 'texture' && write.resource === source) && !variant.required.includes(source))) fail();
    }
  }
}
