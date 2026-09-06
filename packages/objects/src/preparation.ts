import type { JsonRecord, ObjectDescriptor, PreparedObject } from './descriptor.js';

/** A reusable type supplies validation and baking; callers supply its environment. */
export interface ObjectPreparation<Input, Payload, Context> {
  readonly type: string;
  readonly format: string;
  parse(properties: JsonRecord): Input;
  bake(input: Input, context: Context): Payload | Promise<Payload>;
}

export async function prepareObject<Input, Payload, Context>(
  descriptor: ObjectDescriptor,
  preparation: ObjectPreparation<Input, Payload, Context>,
  context: Context,
): Promise<PreparedObject<Payload>> {
  if (descriptor.type !== preparation.type) throw new TypeError(`No ${preparation.type} preparation for ${descriptor.type}.`);
  if (!/^[a-z][a-z0-9.-]*@[1-9][0-9]*$/.test(preparation.format)) throw new TypeError('Preparation requires a versioned output format.');
  const input = preparation.parse(descriptor.properties);
  const data = await preparation.bake(input, context);
  return Object.freeze({ schema: 'cssearth-prepared-object@1', id: descriptor.id,
    type: descriptor.type, format: preparation.format, data });
}

/** Runtime decodes prepared data only. Baking is never an implicit fallback. */
export function readPreparedObject<Payload>(value: unknown, descriptor: ObjectDescriptor, decode: (data: unknown) => Payload): PreparedObject<Payload> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Prepared object must be a record.');
  if (!('schema' in value) || value.schema !== 'cssearth-prepared-object@1' ||
      !('id' in value) || value.id !== descriptor.id || !('type' in value) || value.type !== descriptor.type ||
      !('format' in value) || value.format !== descriptor.prepared?.format || typeof value.format !== 'string' ||
      !('data' in value)) throw new TypeError('Prepared object identity, type, or format does not match its descriptor.');
  const data = decode(value.data);
  return Object.freeze({ schema: 'cssearth-prepared-object@1', id: descriptor.id, type: descriptor.type, format: value.format, data });
}
