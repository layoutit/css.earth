import { LEAF_BOX_PROPERTY, LEAF_BOX_STEP, SURFACE_SEAM_OUTSET_PROPERTY, SURFACE_SEAM_OUTSET_STEP } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';

// Silhouette step names as they ship (the last step of the presentation bindings, prepared-presentation-bindings.ts).
//
// The node builder and the bindings name the two silhouette steps as the custom properties their browser measurement
// reads: `--silhouette-step` for leaf boxes and `--surface-seam-outset` for the seam, with each block of leaf boxes as
// `--silhouette-step-<block>` (leaf-box.ts). After withLeafBoxRecords no element reads them: the page writes each leaf's
// values from its record. What ships names them plainly, on the step bindings and as the keys of their groups, group
// sizes and block placements. A later bindings run restores the custom names first.

const NAMES = [[LEAF_BOX_PROPERTY, LEAF_BOX_STEP], [SURFACE_SEAM_OUTSET_PROPERTY, SURFACE_SEAM_OUTSET_STEP]] as const;
interface Definition { viewBindings: readonly unknown[] }

const keys = (value: unknown, name: (key: string) => string) => isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [name(key), entry])) : value;

function rename<D extends Definition>(definition: D, from: 0 | 1): D {
  const to = from === 0 ? 1 : 0;
  let changed = false;
  const viewBindings = definition.viewBindings.map(binding => {
    if (!isRecord(binding) || binding.kind !== 'silhouette-step-property') return binding;
    const pair = NAMES.find(names => names[from] === binding.property);
    if (!pair) return binding;
    // A block's name is the step's name and its block: `<step>-<block>`.
    const name = (key: string) => key === pair[from] ? pair[to] : key.startsWith(`${pair[from]}-`) ? pair[to] + key.slice(pair[from].length) : key;
    changed = true;
    return { ...binding, property: pair[to],
      ...(binding.groups === undefined ? {} : { groups: keys(binding.groups, name) }),
      ...(binding.groupSizes === undefined ? {} : { groupSizes: keys(binding.groupSizes, name) }),
      ...(isRecord(binding.placements) ? { placements: { ...binding.placements, writes: keys(binding.placements.writes, name) } } : {}) };
  });
  return changed ? { ...definition, viewBindings } : definition;
}

/** The silhouette steps under their plain names; no binding, group or placement names a custom property. */
export const withStepNameRecords = <D extends Definition>(definition: D): D => rename(definition, 0);
/** The custom property names the bindings measure with (the inverse of withStepNameRecords). */
export const withoutStepNameRecords = <D extends Definition>(definition: D): D => rename(definition, 1);
