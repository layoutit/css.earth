import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { localFile } from '../viewer/viewer';

type Candidate = {
  id: string; label: string; previewPath: string; previewUrl: string; sourcePageUrl: string;
  originalUrl: string; nativePixels: number[]; fieldArcminutes: number[]; bands: string; credit: string; note: string;
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const textKeys = ['id', 'label', 'previewPath', 'previewUrl', 'sourcePageUrl', 'originalUrl', 'bands', 'credit', 'note'] as const;
function readCandidates(value: unknown): Candidate[] {
  if (!record(value) || value.schema !== 'cssearth-nebula-source-candidates@1' || !Array.isArray(value.candidates) || !value.candidates.length) throw new Error('Source catalogue unavailable.');
  return value.candidates.map((item: unknown) => {
    if (!record(item) || !textKeys.every(key => typeof item[key] === 'string' && item[key]) ||
      ![item.nativePixels, item.fieldArcminutes].every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) ||
      !['previewUrl', 'sourcePageUrl', 'originalUrl'].every(key => String(item[key]).startsWith('https://'))) throw new Error('Invalid source candidate.');
    // Each field has been checked at this JSON boundary.
    return item as Candidate;
  });
}

/** Read-only source coverage comparison. It cannot launch removal or reconstruction. */
export function EmissionSources({ catalogue }: { catalogue: string }) {
  const [host, setHost] = useState<Element | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState(false);
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(localFile(catalogue), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`Source catalogue unavailable (${response.status}).`);
      const rows = readCandidates(await response.json());
      if (!controller.signal.aborted) { setCandidates(rows); setSelected(rows[0]!.id); }
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Source catalogue unavailable.'); });
    return () => controller.abort();
  }, [catalogue]);
  const candidate = candidates.find(item => item.id === selected);
  return <fieldset className="emission-sources">
    <legend>Source coverage</legend>
    <label>Image<select aria-label="Source candidate" value={selected} onChange={event => { setSelected(event.target.value); setRemote(false); setError(''); }}>
      {candidates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <p className="interaction-hint">Original preview · no processing</p>
    {candidate && <>
      <p className="interaction-hint">{candidate.fieldArcminutes.join(' × ')}′ · {candidate.nativePixels.join(' × ')} native pixels</p>
      <p className="interaction-hint">{candidate.bands}</p>
      <p className="interaction-hint">{candidate.note}</p>
      <a className="model-source" href={candidate.sourcePageUrl} target="_blank" rel="noreferrer">Source & coordinates ↗</a>{' '}
      <a className="model-source" href={candidate.originalUrl} target="_blank" rel="noreferrer">Native image ↗</a>
      <p className="interaction-hint">{candidate.credit}</p>
    </>}
    {error && <p className="interaction-hint" role="alert">{error}</p>}
    {host && createPortal(<figure className="emission-structure-map" aria-label="Source coverage preview">
      {candidate && !error ? <img key={`${candidate.id}-${remote}`} src={remote ? candidate.previewUrl : localFile(candidate.previewPath)} alt={candidate.label}
        onError={() => { if (!remote) setRemote(true); else setError('Source image unavailable.'); }} /> : <p className="interaction-hint">{error || 'Loading source candidates…'}</p>}
      <figcaption className="interaction-hint">{candidate?.label} · full photograph · independently fitted to view</figcaption>
    </figure>, host)}
  </fieldset>;
}
