import { useEffect, useMemo, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { localFile, subjects } from '../legacy-viewer/controller';
import { selectBank, selectedBank } from '../legacy-viewer/bank-selection';

/** One of a nebula's site lenses: a plate bank, or one dataset of a volume dataset bank. */
export interface NebulaLens { key: string; subjectId: string; dataset?: string; label: string }
type Subject = (typeof subjects)[number];
const groupOf = (subject: Subject | undefined) => subject?.plates?.group ?? subject?.siteVolume?.group;

async function json(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(localFile(path), { cache: 'no-store', signal });
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`${path} is unavailable (${response.status}).`);
  return response.json();
}
/** A plate bank's lens label, from its tracked presentation record. */
function plateLabel(presentation: unknown): string {
  if (!isRecord(presentation) || !Array.isArray(presentation.datasets)) return '';
  const chosen = presentation.datasets.find(item => isRecord(item) && item.id === presentation.defaultDataset) ?? presentation.datasets[0];
  return isRecord(chosen) && typeof chosen.label === 'string' ? chosen.label : '';
}
async function lensesOf(subject: Subject, signal: AbortSignal): Promise<NebulaLens[]> {
  if (subject.plates) {
    const label = plateLabel(await json(`${subject.plates.object}/source/presentation.json`, signal).catch(() => null));
    return [{ key: subject.id, subjectId: subject.id, label: label || subject.plates.object.slice('src/objects/'.length) }];
  }
  if (!subject.siteVolume) return [];
  const index = await json(`${subject.siteVolume.object}/prepared/datasets.json`, signal);
  const data = isRecord(index) && isRecord(index.data) ? index.data : null;
  if (!data || !Array.isArray(data.datasets)) throw new TypeError(`${subject.siteVolume.object}: unreadable dataset index.`);
  return data.datasets.flatMap(item => isRecord(item) && typeof item.id === 'string'
    ? [{ key: `${subject.id}:${item.id}`, subjectId: subject.id, dataset: item.id, label: typeof item.label === 'string' ? item.label : item.id }] : []);
}

/** Every lens the site shows for the shown subject's nebula, across its banks, in one dropdown. */
export function NebulaLensSelect({ subjectId, busy, onReload }: { subjectId: string; busy: boolean; onReload(id: string): void }) {
  const subject = subjects.find(item => item.id === subjectId), group = groupOf(subject);
  const members = useMemo(() => subjects.filter(item => groupOf(item) === group), [group]);
  const [lenses, setLenses] = useState<NebulaLens[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(members.map(item => lensesOf(item, controller.signal).catch(() => []))).then(found => {
      if (controller.signal.aborted) return;
      setLenses(found.flat());
    });
    return () => controller.abort();
  }, [members]);
  // A volume bank opens on its default dataset unless one is chosen; the viewer reports the one it shows.
  const shownDataset = subject ? selectedBank(subject).dataset ?? document.getElementById('viewer')?.dataset.bankDataset : undefined;
  const current = lenses.find(lens => lens.subjectId === subjectId && (lens.dataset === undefined || lens.dataset === shownDataset))?.key ?? '';
  return <>
    <label className="visually-hidden" htmlFor="nebula-lens">Lens</label>
    <select id="nebula-lens" value={current} disabled={busy || lenses.length < 2} data-lens-count={lenses.length} onChange={event => {
      const lens = lenses.find(item => item.key === event.target.value); if (!lens) return;
      const target = subjects.find(item => item.id === lens.subjectId);
      if (target && lens.dataset) selectBank(target.id, { directory: selectedBank(target).directory, dataset: lens.dataset });
      onReload(lens.subjectId);
    }}>{lenses.map(lens => <option key={lens.key} value={lens.key}>{lens.label}</option>)}</select>
  </>;
}
