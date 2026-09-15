import type { ArchiveImage, MessierInventory, MessierObject } from './types';

/** Search padding is a discovery policy, not an inferred physical nebula boundary. */
export function searchRadiusDegrees(object: MessierObject): number {
  return Math.max(10 / 60, (object.majorArcmin ?? 40) * .75 / 60);
}
export {imageSuitability} from '@cssearth/nebula-reconstruction/observations/suitability';
/** Deduplicate repeated hits on overlapping targets; never infer identity from similar filenames. */
export function inventoryStorage(inventory: MessierInventory) {
  if (inventory.targets.some(t => t.queries.some(q => q.imagesPath))) {
    if (!inventory.storage) throw new TypeError('Compact inventory is missing its deduplicated size summary.');
    return inventory.storage;
  }
  const images = new Map<string, ArchiveImage>();
  let complete = 0, truncated = 0, errors = 0, pending = 0;
  for (const target of inventory.targets) for (const query of target.queries) {
    if (query.status === 'complete') complete++;
    else if (query.status === 'truncated') truncated++;
    else if (query.status === 'error') errors++; else pending++;
    for (const image of query.images) {
      const key = image.accessUrl ?? `${image.provider}:${image.id}`;
      const previous = images.get(key);
      if (!previous || (image.estimatedBytes ?? 0) > (previous.estimatedBytes ?? 0)) images.set(key, image);
    }
  }
  let estimatedBytes = 0, unknownSizes = 0;
  for (const image of images.values()) { if (image.estimatedBytes === null) unknownSizes++; else estimatedBytes += image.estimatedBytes; }
  return { uniqueImages: images.size, estimatedBytes, unknownSizes, complete, truncated, errors, pending,
    isLowerBound: unknownSizes > 0 || truncated > 0 || errors > 0 || pending > 0 };
}
