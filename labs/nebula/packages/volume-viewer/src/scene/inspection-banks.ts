/** Retained leaf inspection; scene selection and saved application settings stay with the host. */
export type InspectionAxis = 'auto' | 'x' | 'y' | 'z';
export type InspectionComponent = 'all' | 'diffuse' | 'detail';
export interface InspectionBank {
  axis: Exclude<InspectionAxis, 'auto'>; root: HTMLElement;
  leaves: { id: string; nodes: HTMLElement[]; detail: boolean }[];
}
export function dominantInspectionBank(banks: readonly InspectionBank[]): InspectionBank {
  return banks.reduce((best, bank) => Number(bank.root.style.opacity) > Number(best.root.style.opacity) ? bank : best, banks[0]!);
}
export function inspectPreparedLayers(banks: readonly InspectionBank[], state: {
  axis: InspectionAxis; component: InspectionComponent; layer: number | null; layerCount: number;
}, includes?: (id: string) => boolean) {
  if (!banks.length) return { layer: state.layer, layerCount: state.layerCount, countChanged: false };
  const selected = state.axis === 'auto' ? dominantInspectionBank(banks) : banks.find(bank => bank.axis === state.axis)!;
  const includedLeaf = (leaf: InspectionBank['leaves'][number]) => includes ? includes(leaf.id) :
    state.component === 'all' || (state.component === 'detail' ? leaf.detail : !leaf.detail);
  const eligible = selected.leaves.filter(includedLeaf), layerCount = eligible.length;
  const countChanged = state.layerCount !== layerCount;
  const layer = state.layer === null ? null : Math.max(0, Math.min(layerCount - 1, state.layer));
  for (const bank of banks) {
    if (state.axis !== 'auto') {
      bank.root.style.opacity = bank === selected ? '1' : '0';
      bank.root.style.visibility = bank === selected ? 'visible' : 'hidden';
    }
    let index = 0;
    for (const leaf of bank.leaves) {
      const included = includedLeaf(leaf);
      for (const node of leaf.nodes) node.style.visibility = included && (layer === null || index === layer) ? '' : 'hidden';
      if (included) index++;
    }
  }
  return { layer, layerCount, countChanged };
}
export interface InspectionLeafResources {
  id: string; texturePath: string; widthPx: number; heightPx: number;
}
export interface InspectionMount<Publication> {
  publish(publication: Publication): void; destroy(): void;
  banks: InspectionBank[]; overlayMeshes: HTMLElement[];
}
export interface InspectionMountBackend<Bank, Publication> {
  mount(host: HTMLElement, before: Element, payload: Bank, resolveResource: (path: string) => string,
    overlays: boolean): InspectionMount<Publication>;
  leaves(payload: Bank): readonly InspectionLeafResources[];
}
/** Owns the composited cloud surface and renderer mount as one retained scene. */
export function mountInspectionScene<Bank, Publication>(options: {
  backend: InspectionMountBackend<Bank, Publication>; host: HTMLElement; before: Element; payload: Bank;
  resolveResource(path: string): string; composite: boolean; overlays: boolean;
  bind?(leaf: InspectionLeafResources, nodes: HTMLElement[]): void;
  partForLeaf?(id: string): string;
}) {
  const { backend, host, before, payload } = options;
  const surface = options.composite ? host.ownerDocument.createElement('div') : null;
  let marker: HTMLElement | null = null;
  if (surface) {
    surface.className = 'nebula-cloud-surface';
    surface.style.position = 'absolute'; surface.style.inset = '0'; surface.style.pointerEvents = 'none';
    marker = host.ownerDocument.createElement('span'); marker.hidden = true; surface.append(marker); host.insertBefore(surface, before);
  }
  const mounted = backend.mount(surface ?? host, marker ?? before, payload, options.resolveResource, options.overlays);
  const resources = new Map(backend.leaves(payload).map(leaf => [leaf.id, leaf]));
  for (const bank of mounted.banks) for (const leaf of bank.leaves) {
    if (options.bind) options.bind(resources.get(leaf.id)!, leaf.nodes);
    if (options.partForLeaf) for (const node of leaf.nodes) node.dataset.cloudPart = options.partForLeaf(leaf.id);
  }
  return { banks: mounted.banks, overlayMeshes: mounted.overlayMeshes, root: surface,
    publish: (publication: Publication) => mounted.publish(publication),
    setOpacity(value: number) { if (surface) surface.style.opacity = String(value); },
    destroy() { mounted.destroy(); surface?.remove(); } };
}
