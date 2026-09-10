import { object, text, integer, boolean, numbers } from './oracle-values.mts';

/** Fields emitted by contract-render-hook.mm; unknown metadata remains untouched. */
export function parseNativeTexture(value: unknown) {
  const raw = object(value, 'native sampler');
  return {...raw, texture: integer(raw.texture), width: integer(raw.width), height: integer(raw.height),
    internalFormat: integer(raw.internalFormat), minFilter: integer(raw.minFilter), magFilter: integer(raw.magFilter),
    wrapS: integer(raw.wrapS), wrapT: integer(raw.wrapT),
    ...(raw.dumpPath === undefined ? {} : {dumpPath: text(raw.dumpPath)})};
}
export type NativeTexture = ReturnType<typeof parseNativeTexture>;
export function parseNativeAttribute(value: unknown) {
  const raw = object(value, 'native vertex attribute');
  return {...raw, buffer: integer(raw.buffer), bufferBytes: integer(raw.bufferBytes), components: integer(raw.components),
    stride: integer(raw.stride),
    ...(raw.dumpPath === undefined ? {} : {dumpPath: text(raw.dumpPath)}),
    ...(raw.clientDumpPath === undefined ? {} : {clientDumpPath: text(raw.clientDumpPath)}),
    ...(raw.clientBytes === undefined ? {} : {clientBytes: integer(raw.clientBytes)})};
}
export type NativeAttribute = ReturnType<typeof parseNativeAttribute>;
export function parseNativeSnapshot(value: unknown) {
  const raw = object(value, 'native renderer snapshot'), classification = object(raw.classification);
  const uniforms: Record<string, number[]> = {};
  for (const [name, value] of Object.entries(object(raw.uniforms))) uniforms[name] = numbers(value, `uniform ${name}`);
  const samplers: Record<string, NativeTexture> = {};
  for (const [name, value] of Object.entries(object(raw.samplers))) samplers[name] = parseNativeTexture(value);
  const attributes: Record<string, NativeAttribute> = {};
  for (const [name, value] of Object.entries(object(raw.attributes))) attributes[name] = parseNativeAttribute(value);
  const viewport = numbers(raw.viewport), blend = numbers(raw.blend);
  if (viewport.length !== 4 || blend.length !== 4) throw new TypeError('Native viewport/blend record needs four components.');
  return {...raw, revision: integer(raw.revision), context: text(raw.context), program: integer(raw.program),
    primitive: integer(raw.primitive), count: integer(raw.count), viewport, blend,
    blendEnabled: boolean(raw.blendEnabled), depthTestEnabled: boolean(raw.depthTestEnabled), depthWrite: boolean(raw.depthWrite),
    classification: {...classification, skyMap: boolean(classification.skyMap), catalogueStars: boolean(classification.catalogueStars)},
    uniforms, samplers, attributes};
}
export type NativeSnapshot = ReturnType<typeof parseNativeSnapshot>;
