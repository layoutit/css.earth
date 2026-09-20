export const NAVIGATION_TREE_SCHEMA = 'cssearth-navigation-tree@1' as const;

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
}

export interface NavigationTreePayload {
  schema: typeof NAVIGATION_TREE_SCHEMA;
  roots: string[];
  nodes: Record<string, NavigationTreeRecord>;
}
