import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { OverviewScope } from './overview-context.mts';

export interface ShellOverview {
  readonly scope: OverviewScope;
  readonly systemId: string;
}

/** A focus uses the mounted body's camera and may temporarily cover its overview. */
export interface ShellSelection {
  readonly objectId: string;
  readonly overview: ShellOverview | null;
  readonly focus: PreparedCatalogObject | null;
}

export type ShellSubject =
  | { readonly kind: 'object'; readonly objectId: string }
  | { readonly kind: 'overview'; readonly overview: ShellOverview }
  | { readonly kind: 'focus'; readonly record: PreparedCatalogObject };

/** Resolve the one subject shown by the sidebar without changing the mounted scene. */
export function selectedShellSubject(selection: ShellSelection): ShellSubject {
  if (selection.focus) return { kind: 'focus', record: selection.focus };
  if (selection.overview) return { kind: 'overview', overview: selection.overview };
  return { kind: 'object', objectId: selection.objectId };
}
