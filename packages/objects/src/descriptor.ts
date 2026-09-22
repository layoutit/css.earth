/** Configuration data contains no renderer implementation or individual object facts. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonRecord;
export interface JsonRecord { readonly [key: string]: JsonValue; }
export interface PreparedAssetReference {
  readonly format: string;
  readonly url: string;
}
export interface ObjectDescriptor {
  readonly schema: 'cssearth-object@1';
  readonly id: string;
  readonly type: string;
  /** Parameters interpreted by the registered reusable object type. */
  readonly properties: JsonRecord;
  /** A bake may attach an artifact without changing the authored properties. */
  readonly prepared?: PreparedAssetReference;
}
export interface PreparedObject<Payload> {
  readonly schema: 'cssearth-prepared-object@1';
  readonly id: string;
  readonly type: string;
  readonly format: string;
  readonly data: Payload;
}
