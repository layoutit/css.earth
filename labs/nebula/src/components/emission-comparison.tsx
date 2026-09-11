import { useState } from 'react';
import { localFile } from '../viewer/viewer';
import { EmissionStructures } from './emission-structures';
import { EmissionSources } from './emission-sources';

/** Read-only numerical comparisons; selecting a view never starts a reconstruction. */
export function EmissionComparison({ directory, structureDirectory, sourceCatalogue, modeled = false, methodUrl, credit, statusNote }: {
  directory: string; structureDirectory?: string; sourceCatalogue?: string; modeled?: boolean; methodUrl?: string; credit?: string; statusNote?: string;
}) {
  const [mode, setMode] = useState<'sources' | 'structure' | 'volume'>(() => sourceCatalogue && new URLSearchParams(location.search).get('inspection') === 'sources' ? 'sources' : 'structure');
  const structureMode = Boolean(structureDirectory) && mode === 'structure';
  const sourcesMode = Boolean(sourceCatalogue) && mode === 'sources';
  return <aside className="floating-panel cloud-adjustment-panel" aria-label="Emission inference comparison">
    {structureDirectory && <div className="emission-view-buttons" role="group" aria-label="Inspection mode">
      {sourceCatalogue && <button type="button" aria-pressed={sourcesMode} onClick={() => setMode('sources')}>Source candidates</button>}
      <button type="button" aria-pressed={structureMode} onClick={() => setMode('structure')}>Structure map</button>
      <button type="button" aria-pressed={!structureMode && !sourcesMode} title="Previous volume baseline; this structure map has not supplied new depths yet." onClick={() => setMode('volume')}>Volume</button>
    </div>}
    {sourcesMode && sourceCatalogue ? <EmissionSources key={sourceCatalogue} catalogue={sourceCatalogue} /> : structureMode && structureDirectory ? <EmissionStructures key={structureDirectory} directory={structureDirectory} /> : <fieldset>
      <legend>{modeled ? 'Image + geometric prior' : 'Image → inferred volume'}</legend>
      {statusNote && <p className="interaction-hint">{statusNote}</p>}
      {[
        ['input.png', 'Input · compact light attenuated'],
        ['projection.png', 'Volume projected toward Earth'],
        ['residual.png', 'Difference ×4'],
      ].map(([file, label]) => <figure key={file} style={{ margin: '12px 0' }}>
        <img src={localFile(`${directory}/${file}`)} alt={label} style={{ width: '100%', display: 'block' }} />
        <figcaption className="interaction-hint">{label}</figcaption>
      </figure>)}
      <p className="interaction-hint" title={modeled ? 'The published geometry sets a depth prior. Color is allocated along its rays; agreement with the photo does not prove the geometry.' : 'The depth is inferred under an authored axial-symmetry assumption. Physical size and gas mass density are not measured. The projection comparison is numerical; the PolyCSS display uses an approximate opacity transfer.'}>{modeled ? 'Authored depth · photo agreement imposed' : 'Symmetry-based experiment · unmeasured depth'}</p>
    </fieldset>}
    {!structureMode && !sourcesMode && <a className="model-source" href={methodUrl ?? 'https://doi.org/10.1111/cgf.12216'} target="_blank" rel="noreferrer">Reconstruction paper ↗</a>}
    {!sourcesMode && credit && <p className="interaction-hint">{credit}</p>}
  </aside>;
}
