import { parseCloudAppearance, type CloudAppearance } from '@cssearth/bake/volume';

const key = (subjectId: string, imageId: string) => `cssearth-nebula-cloud-appearance@1:${subjectId}:${imageId}`;
export function readCloudAppearance(subjectId: string, imageId: string, fallback?: CloudAppearance): CloudAppearance {
  try {
    const saved = localStorage.getItem(key(subjectId, imageId));
    if (saved) return parseCloudAppearance(JSON.parse(saved));
  } catch { /* Invalid/old storage must not prevent loading an existing result. */ }
  return parseCloudAppearance(fallback);
}
export function saveCloudAppearance(subjectId: string, imageId: string, value: CloudAppearance) {
  try { localStorage.setItem(key(subjectId, imageId), JSON.stringify(parseCloudAppearance(value))); }
  catch { /* Session controls remain usable without storage. */ }
}
