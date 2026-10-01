import type { OverviewObject } from '@cssearth/objects';
import type { ObjectResultEntry } from '../search/object-result.mts';
import { objectClassificationLabel } from '../object-classification-label.mts';
import { sidebarThumbnail } from '../sidebar-thumbnails.mts';
import { sourceDocumentation } from '../source-documentation.mts';

/** Overview links share search's row, without inventing an observer distance for a navigation level. */
export function overviewResult(overview: OverviewObject): ObjectResultEntry {
  const source = sourceDocumentation(overview.id, overview.name);
  return { kind: 'overview', id: overview.id, name: overview.name, route: overview.route,
    classificationName: objectClassificationLabel(overview.classification ?? 'overview'),
    source: { subject: `overview:${overview.id}`, document: source.href, label: source.label },
    marker: { kind: 'thumbnail', thumbnail: sidebarThumbnail(overview.id)?.url2x ?? null } };
}
