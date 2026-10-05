import { isRecord } from '@cssearth/core';

/** What the rule reads of an object: its place in the object tree and in the world. */
interface Placed { readonly id: string; readonly parent?: string; readonly system?: { readonly host: string }; readonly worldFrame: { readonly originM: readonly number[] } }

/** The objects whose picture lies on walls around their middle: the hosts of the image banks that say so
 * (`properties.surrounds`, packages/objects/src/image-layer-bank.ts), among the world's context descriptors. */
export function surroundingHosts(descriptors: Readonly<Record<string, unknown>>): ReadonlySet<string> {
  return new Set(Object.values(descriptors).flatMap(descriptor =>
    isRecord(descriptor) && isRecord(descriptor.properties) && descriptor.properties.surrounds === true && typeof descriptor.properties.host === 'string'
      ? [descriptor.properties.host] : []));
}

/**
 * The body the walls of object `id` surround: the object inside it, by the object tree, that stands nearest its centre, as
 * a planetary nebula's central star. A system inside it stands for its host. Undefined for an object whose picture is not on
 * walls around its middle (a galaxy's photograph), and for one with nothing inside it. The object's entry names it
 * (`inner`), and a zoom in on the object leads to it (overview-selection.mts).
 */
export function surroundedBody(objects: readonly Placed[], surrounding: ReadonlySet<string>, id: string): string | undefined {
  const holder = objects.find(object => object.id === id);
  if (!holder || !surrounding.has(id)) return undefined;
  const from = holder.worldFrame.originM;
  return objects.filter(object => object.parent === id)
    .map(object => object.system ? objects.find(host => host.id === object.system!.host) ?? object : object)
    .map(object => ({ id: object.id, offsetM: Math.hypot(...object.worldFrame.originM.map((value, axis) => value - from[axis]!)) }))
    .sort((a, b) => a.offsetM - b.offsetM || a.id.localeCompare(b.id))[0]?.id;
}
