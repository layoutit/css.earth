export type LabView = 'alignment' | 'reconstruction';

export function labView(url: URL): LabView {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/alignment') return 'alignment';
  if (path === '/reconstruction') return 'reconstruction';
  return ['render', 'reconstruction'].includes(url.searchParams.get('tab') ?? '') ? 'reconstruction' : 'alignment';
}

/** Normalize legacy tab links without discarding the selected object or other state. */
export function labViewUrl(url: URL, view: LabView): URL {
  const next = new URL(url);
  next.pathname = `/${view}`;
  next.searchParams.delete('tab');
  return next;
}

export type LabPage = LabView | 'catalogue';

/** One selected-object parameter; continue accepting old catalogue bookmarks. */
export function labObjectId(url: URL): string | null {
  return url.searchParams.get('subject') ?? url.searchParams.get('object');
}

export function labPageUrl(url: URL, page: LabPage, objectId: string): URL {
  const next = labViewUrl(url, page === 'catalogue' ? 'alignment' : page);
  next.pathname = `/${page}`;
  next.searchParams.set('subject', objectId);
  next.searchParams.delete('object');
  return next;
}
