/** Configuration data contains no renderer implementation or individual object facts. */
export const PREPARED_OBJECT_SCHEMA = 'cssearth-prepared-object@1';
export const OBJECT_SCHEMA = 'cssearth-object@2';
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonRecord;
export interface JsonRecord { readonly [key: string]: JsonValue; }
export interface PreparedAssetReference {
  readonly format: string;
  readonly url: string;
}
export interface ObjectDescriptor {
  readonly schema: typeof OBJECT_SCHEMA;
  readonly id: string;
  readonly type: string;
  /** The one object this object is inside (object-tree.ts). Only the root, the Observable Universe, has none; a dataset bank has
   * none either: it is attached to the object it draws for by `properties.host`, not inside it. */
  readonly parent?: string;
  /** Parameters interpreted by the registered reusable object type. */
  readonly properties: JsonRecord;
  /** A bake may attach an artifact without changing the authored properties. */
  readonly prepared?: PreparedAssetReference;
}
export interface PreparedObject<Payload> {
  readonly schema: typeof PREPARED_OBJECT_SCHEMA;
  readonly id: string;
  readonly type: string;
  readonly format: string;
  readonly data: Payload;
}
