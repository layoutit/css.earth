import type { PreparedCssImageLayers, PreparedCssVolume } from '@cssearth/objects';
import { loadPreparedCssImageLayers, loadPreparedCssVolume, loadPreparedVolumeDatasets, preparedTransportReader } from '../../adapters/viewer/prepared-loaders';
/** Which prepared bank a subject shows when it has more than one: the site's own prepared bank by default, or a lab
 * bake of the same object (a draft or a full bake), and for a volume dataset bank which of its datasets. The viewer
 * reads this when it loads the subject; the panel that changes it reloads the subject, and the reload keeps the camera. */
export interface BankSelection { directory: string; dataset?: string }
const selections = new Map<string, BankSelection>();
export function selectedBank(subject: { id: string; directory: string }): BankSelection {
  return selections.get(subject.id) ?? { directory: subject.directory };
}
export function selectBank(subjectId: string, selection: BankSelection | null) {
  if (selection) selections.set(subjectId, { ...selection }); else selections.delete(subjectId);
}

/** A subject's prepared bank as the site's loaders read it: an image-layer bank, a volume, or one dataset of a volume
 * dataset bank (the selected one, or its default) with the bank's framing radius. */
export async function loadSelectedBank(descriptor: { type?: unknown }, fetchBytes: (path: string) => Promise<ArrayBuffer>, bank: BankSelection): Promise<{
  isImage: boolean; loaded: PreparedCssVolume | PreparedCssImageLayers; shownDataset: string | null; framingRadius?: number }> {
  if (descriptor.type === 'volume-dataset-bank') {
    const datasets = await loadPreparedVolumeDatasets(descriptor, { read: fetchBytes },
      { resolve: path => path, read: preparedTransportReader({ read: fetchBytes }), ...(bank.dataset ? { dataset: bank.dataset } : {}) });
    const shown = bank.dataset && datasets.volume(bank.dataset) ? bank.dataset : datasets.index.defaultDataset;
    return { isImage: false, loaded: datasets.volume(shown)!, shownDataset: shown, framingRadius: datasets.index.framingRadiusUnits };
  }
  const isImage = descriptor.type === 'image-layer-bank';
  return { isImage, shownDataset: null, loaded: await (isImage ? loadPreparedCssImageLayers : loadPreparedCssVolume)(descriptor, { read: fetchBytes }) };
}
/** An image-layer bank shows a stack once its images decode, at the next camera publication. The site publishes every
 * frame; the lab viewer publishes on change, so it publishes again until a stack is shown (at most ~4 s of frames). */
export function settleImageBank(host: HTMLElement, publish: () => void, current: () => boolean) {
  let frames = 0;
  const settle = () => {
    if (!current()) return;
    const shown = [...host.querySelectorAll<HTMLElement>('[data-image-layer-axis]')].some(stack => stack.style.visibility === 'visible' && Number(stack.style.opacity) > 0);
    if (!shown && frames++ < 240) { publish(); requestAnimationFrame(settle); }
  };
  requestAnimationFrame(settle);
}
