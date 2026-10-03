import { parseCloudAppearance, type CloudAppearance } from '@cssearth/objects';
export { parseCloudAppearance, DEFAULT_CLOUD_APPEARANCE, type CloudAppearance } from '@cssearth/objects';
export function sameCloudAppearance(a?: CloudAppearance, b?: CloudAppearance) {
  const left = parseCloudAppearance(a), right = parseCloudAppearance(b);
  return left.saturation === right.saturation && left.detailStrength === right.detailStrength && left.detailScale === right.detailScale &&
    left.brightness === right.brightness && left.gamma === right.gamma;
}
