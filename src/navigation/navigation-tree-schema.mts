export const NAVIGATION_TREE_SCHEMA = 'cssearth-navigation-tree@2' as const;

export interface NavigationTreeMarker {
  className: string;
  style: string;
}

export interface NavigationTreeRecord {
  label: string;
  objectId: string | null;
  place: boolean;
  count: number;
  marker: NavigationTreeMarker | null;
  children: string[];
  /** Where this row opens, or null when this site cannot open it: then it is a label, not a link. */
  href: string | null;
  /** The catalogue subject to select in place, when that destination is a focus on the mounted world. */
  focusId: string | null;
}

export interface NavigationTreePayload {
  schema: typeof NAVIGATION_TREE_SCHEMA;
  roots: string[];
  nodes: Record<string, NavigationTreeRecord>;
}
