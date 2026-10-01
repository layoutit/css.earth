import { publishDatasetPreview, sectionElements, showSection } from '@cssearth/renderer';
import { objectIdAtPath } from './root-object.mts';
import { knownObject } from './object-directory.mts';

/** The datasets of a page the world draws around the mounted scene (an overview): its package's datasets, shown with the
 * shared dataset card inside its card and chosen, as on every page, by `?dataset=` on its own page. The card carries each
 * dataset's view and the default (`data-page-datasets`), so the page, its runtime and the server read them from the document
 * (ExtragalacticOverviews.astro, from the package's prepared `datasets.json`). */
export interface PageDatasets { readonly page: string; readonly root: HTMLElement; readonly defaultDataset: string; readonly views: ReadonlyMap<string, string> }

export function readPageDatasets(document: ParentNode): PageDatasets[] {
  // An overview card waits in a template until shown (detached-sections.ts); its datasets are read there too.
  return sectionElements(document, '[data-page-datasets]').map(root => {
    const page = root.dataset.pageDatasets ?? '', defaultDataset = root.dataset.defaultDataset ?? '';
    const views = new Map(Object.entries(JSON.parse(root.dataset.datasetViews ?? '{}') as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    if (!page || !views.has(defaultDataset)) throw new TypeError(`Invalid page datasets: ${page || 'unnamed'} needs its datasets' views and default.`);
    return { page, root, defaultDataset, views };
  });
}

/** The dataset a URL selects on a page: its `dataset` while the URL is that page, or the default. */
export function selectedPageDataset(url: string | URL, datasets: Pick<PageDatasets, 'page' | 'defaultDataset' | 'views'>): string {
  const location = new URL(url);
  const requested = objectIdAtPath(location.pathname) === datasets.page ? location.searchParams.get('dataset') : null;
  return requested !== null && datasets.views.has(requested) ? requested : datasets.defaultDataset;
}

/** Mark each page's selected dataset in its card, in the server's document or the live page. A page's datasets show only on
 * the scene that hosts it (`sceneId`): another star zoomed out to the same level shows the level's card without them,
 * since choosing one would mean leaving that star for the page. */
export function presentPageDatasets(document: ParentNode, url: string | URL, sceneId: string) {
  for (const datasets of readPageDatasets(document)) {
    const page = knownObject(datasets.page), hosted = page?.zoom !== undefined && page.sceneHostId === sceneId;
    if (datasets.root.hidden !== !hosted) datasets.root.hidden = !hosted;
    // Their tab goes with them: from another star the Observable Universe card showed a Datasets tab over nothing
    // (2026-10-01). A card left with no tab hides the row; one whose Datasets tab was open opens its first other tab.
    const tab = sectionElements(document, `#${datasets.page}-datasets-tab`)[0] as HTMLInputElement | undefined, row = tab?.parentElement;
    if (tab && row) {
      const label = row.querySelector<HTMLElement>(`label[for="${tab.id}"]`);
      const others = [...row.querySelectorAll<HTMLInputElement>('input.object-native-tab')].filter(other => other !== tab);
      if (tab.hidden !== !hosted) tab.hidden = !hosted;
      if (label && label.hidden !== !hosted) label.hidden = !hosted;
      if (!others.length && row.hidden !== !hosted) row.hidden = !hosted;
      if (!hosted && tab.checked && others[0]) others[0].click();
    }
    const dataset = selectedPageDataset(url, datasets);
    const buttons = [...datasets.root.querySelectorAll<HTMLButtonElement>('button[name="dataset"]')];
    for (const button of buttons) {
      const pressed = String(button.getAttribute('value') === dataset);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    }
    publishDatasetPreview(datasets.root, buttons);
    for (const detail of sectionElements(datasets.root, '[data-page-dataset-details]')) showSection(detail, detail.dataset.pageDatasetDetails === dataset);
  }
}
