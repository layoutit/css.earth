import { useEffect, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { localFile, subjects } from '../legacy-viewer/subject-catalogue';
import { isAppDatasetId } from './site-scene-url.ts';
import type { SiteLabControlsProps } from '../../state/use-lab-controller';

/** The page's datasets' names, as its own dataset list shows them (src/objects/<id>/source/content/object.json). */
async function datasetLabels(object: string, signal: AbortSignal): Promise<Map<string, string>> {
  const response = await fetch(localFile(`src/objects/${object}/source/content/object.json`), { cache: 'no-store', signal });
  const content: unknown = response.ok ? await response.json() : null;
  const controls = isRecord(content) && isRecord(content.datasets) && Array.isArray(content.datasets.controls) ? content.datasets.controls : [];
  return new Map(controls.flatMap(control => isRecord(control) && isAppDatasetId(control.id) && typeof control.label === 'string' ? [[control.id, control.label] as const] : []));
}

/** **Dataset**: the website page's dataset, chosen as its own dataset list chooses it. The page reports which it shows. */
export function SiteDatasetSelect({ shell, controller }: SiteLabControlsProps) {
  const object = subjects.find(item => item.id === shell.objectId)?.app?.object ?? '';
  const [labels, setLabels] = useState(new Map<string, string>());
  useEffect(() => {
    if (!object) return;
    const abort = new AbortController();
    void datasetLabels(object, abort.signal).then(found => { if (!abort.signal.aborted) setLabels(found); }).catch(() => {});
    return () => abort.abort();
  }, [object]);
  const site = shell.site, datasets = site?.datasets ?? [];
  return <select id="nebula-lens" value={site?.dataset ?? ''} disabled={!site?.ready || datasets.length < 2} data-lens-count={datasets.length}
    onChange={event => void controller.current?.selectDataset(event.currentTarget.value).catch(() => {})}>
    {datasets.map(id => <option key={id} value={id}>{labels.get(id) ?? id}</option>)}
  </select>;
}
