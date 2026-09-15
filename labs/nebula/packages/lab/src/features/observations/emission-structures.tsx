import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { localFile } from '../legacy-viewer/controller';

const layers = ['source', 'combined', 'diffuse', 'arcs', 'knots', 'unassigned'] as const;
type Layer = typeof layers[number];
type Panel = { id: Layer; label: string; file: string; description: string };
type StructureMap = {
  dimensions: { width: number; height: number }; panels: Panel[];
  metrics: { reconstructionMaxError: number; unassignedFraction: number; regions: number };
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const layer = (value: unknown): value is Layer => layers.some(id => id === value);
function readMap(value: unknown): StructureMap {
  if (!record(value) || value.schema !== 'cssearth-nebula-structure-map@1' || !record(value.dimensions) || !record(value.metrics) || !Array.isArray(value.panels)) throw new Error('Invalid structure-map manifest.');
  const { width, height } = value.dimensions;
  const { reconstructionMaxError, unassignedFraction, regions } = value.metrics;
  if (!finite(width) || !Number.isInteger(width) || width < 1 || !finite(height) || !Number.isInteger(height) || height < 1 ||
      !finite(reconstructionMaxError) || reconstructionMaxError < 0 || !finite(unassignedFraction) || unassignedFraction < 0 || unassignedFraction > 1 ||
      !finite(regions) || !Number.isInteger(regions) || regions < 0) throw new Error('Invalid structure-map dimensions or metrics.');
  const panels = value.panels.map((item: unknown): Panel => {
    if (!record(item) || !layer(item.id) || typeof item.label !== 'string' || !item.label.trim() || typeof item.description !== 'string' ||
        typeof item.file !== 'string' || !item.file || /[\\:?#]/.test(item.file) || item.file.startsWith('/') || item.file.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid structure-map panel.');
    return { id: item.id, label: item.label, file: item.file, description: item.description };
  });
  if (panels.length !== layers.length || new Set(panels.map(panel => panel.id)).size !== layers.length) throw new Error('Structure-map layers are incomplete.');
  return { dimensions: { width, height }, panels: panels.sort((a, b) => layers.indexOf(a.id) - layers.indexOf(b.id)), metrics: { reconstructionMaxError, unassignedFraction, regions } };
}

/** Displays prepared full-frame images only; no image analysis or reconstruction runs here. */
export function EmissionStructures({ directory }: { directory: string }) {
  const [selected, setSelected] = useState<Layer>('combined');
  const [host, setHost] = useState<Element | null>(null);
  const [load, setLoad] = useState<{ directory: string; map?: StructureMap; error?: string }>({ directory });
  const [failedImage, setFailedImage] = useState<string | null>(null);
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ directory }); setSelected('combined');
    void fetch(localFile(`${directory}/structure-map.json`), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`Structure map unavailable (${response.status}).`);
      const value: unknown = await response.json();
      const map = readMap(value);
      if (!controller.signal.aborted) setLoad({ directory, map });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoad({ directory, error: error instanceof Error ? error.message : 'Structure map unavailable.' });
    });
    return () => controller.abort();
  }, [directory]);
  const state = load.directory === directory ? load : { directory };
  const panel = state.map?.panels.find(item => item.id === selected);
  const imageUrl = panel ? localFile(`${directory}/${panel.file}`) : undefined;
  const error = state.error ?? (imageUrl && failedImage === imageUrl ? 'Structure image unavailable.' : undefined);
  return <fieldset className="emission-structures">
    <legend>Structure map</legend>
    <p className="interaction-hint">2D inspection · full source frame</p>
    <div className="emission-layer-buttons" role="group" aria-label="Structure layer">
      {(state.map?.panels ?? layers.map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1), description: '' }))).map(item =>
        <button key={item.id} type="button" aria-pressed={selected === item.id} disabled={!state.map} title={item.description} onClick={() => setSelected(item.id)}>{item.label}</button>)}
    </div>
    <div className="emission-legend" aria-label="Combined map colors">
      {(['diffuse', 'arcs', 'knots', 'unassigned'] as const).map(id => <span key={id} data-layer={id}>{id.charAt(0).toUpperCase() + id.slice(1)}</span>)}
    </div>
    {state.map && <>
      <p className="interaction-hint" title={`Maximum reconstruction error: ${state.map.metrics.reconstructionMaxError}. Accounting does not mean all signal is classified.`}>
        {state.map.metrics.reconstructionMaxError < 1e-5 ? 'All input accounted for' : `Accounting error: ${state.map.metrics.reconstructionMaxError.toExponential(1)}`}
      </p>
      <p className="interaction-hint">Unassigned {(state.map.metrics.unassignedFraction * 100).toFixed(1)}% · {state.map.metrics.regions.toLocaleString()} scale regions</p>
    </>}
    <p className="interaction-hint emission-structure-status" role="status" data-error={Boolean(error)}>{error ?? (!state.map ? 'Loading prepared structure map…' : '')}</p>
    {host && createPortal(<figure className="emission-structure-map" aria-label="Prepared 2D structure inspection">
      {panel && state.map && imageUrl && !error ? <img key={imageUrl} src={imageUrl} width={state.map.dimensions.width} height={state.map.dimensions.height}
        alt={`${panel.label} — ${panel.description}. Full source frame, 2D inspection.`} onError={() => setFailedImage(imageUrl)} /> : <p className="interaction-hint">{error ?? 'Loading prepared structure map…'}</p>}
      {panel && <figcaption className="interaction-hint" title={panel.description}>{panel.label} · full frame</figcaption>}
    </figure>, host)}
  </fieldset>;
}
