import { publishDatasetPreview } from '@cssearth/renderer';
import { objectIdAtPath } from './root-object.mts';

/** The datasets of a page the world draws around the mounted scene (an overview): its package's lenses, shown with the
 * shared dataset card inside its card and chosen, as on every page, by `?dataset=` on its own page. The card carries each
 * lens's view and the default (`data-page-datasets`), so the page, its runtime and the server read them from the document
 * (ExtragalacticOverviews.astro, from the package's prepared `datasets.json`). */
export interface PageDatasets { readonly page: string; readonly root: HTMLElement; readonly defaultLens: string; readonly views: ReadonlyMap<string, string> }

export function readPageDatasets(document: ParentNode): PageDatasets[] {
  return [...document.querySelectorAll<HTMLElement>('[data-page-datasets]')].map(root => {
    const page = root.dataset.pageDatasets ?? '', defaultLens = root.dataset.defaultLens ?? '';
    const views = new Map(Object.entries(JSON.parse(root.dataset.lensViews ?? '{}') as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    if (!page || !views.has(defaultLens)) throw new TypeError(`Invalid page datasets: ${page || 'unnamed'} needs its lenses' views and default.`);
    return { page, root, defaultLens, views };
  });
}

/** The lens a URL selects on a page: its `dataset` while the URL is that page, or the default. */
export function selectedPageLens(url: string | URL, datasets: Pick<PageDatasets, 'page' | 'defaultLens' | 'views'>): string {
  const location = new URL(url);
  const requested = objectIdAtPath(location.pathname) === datasets.page ? location.searchParams.get('dataset') : null;
  return requested !== null && datasets.views.has(requested) ? requested : datasets.defaultLens;
}

/** Mark each page's selected lens in its card, in the server's document or the live page. */
export function presentPageDatasets(document: ParentNode, url: string | URL) {
  for (const datasets of readPageDatasets(document)) {
    const lens = selectedPageLens(url, datasets);
    const buttons = [...datasets.root.querySelectorAll<HTMLButtonElement>('button[name="dataset"]')];
    for (const button of buttons) {
      const pressed = String(button.getAttribute('value') === lens);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    }
    publishDatasetPreview(datasets.root, buttons);
    for (const detail of datasets.root.querySelectorAll<HTMLElement>('[data-focus-lens-details]')) {
      const hidden = detail.dataset.focusLensDetails !== lens;
      if (detail.hidden !== hidden) detail.hidden = hidden;
    }
  }
}
