import { useEffect, useState } from 'react';
import type { CandidateModelState, CandidateModelSummary } from './candidate-models';
import type { CandidatePicture } from './candidate-pictures';

/** The models the lab keeps for a plate object; none when the object has no candidate set. */
export function useCandidateModels(object: string) {
  const [models, setModels] = useState<CandidateModelSummary[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/__nebula/plate-candidate-models?object=${encodeURIComponent(object)}`, { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ models?: CandidateModelSummary[] }> : { models: [] })
      .then(body => setModels(Array.isArray(body.models) ? body.models : []))
      .catch(() => { if (!controller.signal.aborted) setModels([]); });
    return () => controller.abort();
  }, [object]);
  return models;
}

const KIND = { measured: 'measured', simulation: 'simulation', illustration: 'illustration' } as const;
const TEXTURES = { auto: 'Auto', nircam: 'Webb NIRCam', miri: 'Webb MIRI F2100W', chandra: 'Chandra 3-band', none: 'Flat color' } as const;
/** `picture:<id>` lays a candidate image on the registered plane; `model:<id>` puts a published 3D model in the bank's place. */
export type CompareValue = '' | `picture:${string}` | `model:${string}`;

/** One **Compare with** dropdown: the object's candidate images and candidate 3D models. A model's texture and the
 * 153″ shock outline appear only while a model is compared. Details (registration, citation, placement) are on each
 * option's tooltip and in the object's README. */
export function CompareWith({ value, pictures, models, modelState, busy, onChange, onModelState }: {
  value: CompareValue; pictures: readonly CandidatePicture[]; models: readonly CandidateModelSummary[]; modelState: CandidateModelState; busy: boolean;
  onChange(value: CompareValue): void; onModelState(state: CandidateModelState): void;
}) {
  if (!pictures.length && !models.length) return null;
  const model = value.startsWith('model:') ? models.find(item => `model:${item.id}` === value) : undefined;
  return <>
    <div className="step-field" data-compare={value}>
      <label htmlFor="compare-with">Compare with</label>
      <select id="compare-with" value={value} disabled={busy} onChange={event => onChange(event.currentTarget.value as CompareValue)}>
        <option value="">Nothing</option>
        {pictures.length > 0 && <optgroup label="Images">
          {pictures.map(item => <option key={item.id} value={`picture:${item.id}`} title={`${item.registration} ${item.credit}`}>
            {item.label}{item.registered ? item.approximate ? ' · approx. WCS' : '' : ' · unregistered'}</option>)}
        </optgroup>}
        {models.length > 0 && <optgroup label="3D models">
          {models.map(item => <option key={item.id} value={`model:${item.id}`} title={`${item.citation}. ${item.placement}`}>
            {item.label} · {KIND[item.kind]}{item.verdict ? ` · ${item.verdict.kind}` : ''}</option>)}
        </optgroup>}
      </select>
    </div>
    {model && <div className="step-field">
      <label htmlFor="compare-texture">Texture</label>
      <select id="compare-texture" value={modelState.texture} disabled={busy} title="The registered picture projected along Earth's line of sight onto the model."
        onChange={event => onModelState({ ...modelState, texture: event.currentTarget.value as CandidateModelState['texture'] })}>
        {Object.entries(TEXTURES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </div>}
    {models.length > 0 && <label className="observation-check step-check"><input type="checkbox" checked={modelState.shock} disabled={busy}
      onChange={event => onModelState({ ...modelState, shock: event.currentTarget.checked })} />153″ shock outline</label>}
  </>;
}
