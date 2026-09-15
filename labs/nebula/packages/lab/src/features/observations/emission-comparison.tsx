import { useState } from 'react';
import { localFile } from '../legacy-viewer/controller';
import { EmissionStructures } from './emission-structures';
import { EmissionSources } from './emission-sources';
import { ObservationStructures } from './observation-structures';
import { EvidenceFusion } from '../evidence/evidence-fusion';
import { KinematicsPanel } from '../kinematics/kinematics-panel';
import { JointFitPanel } from '../joint-fit/joint-fit-panel';
import { CompilerPanel } from '../compiler/compiler-panel';

/** Observation views and explicitly configured bounded inference workbenches. */
export function EmissionComparison({ directory, structureDirectory, observationStructures, observationManifest, kinematicsSource, jointFitSource, compilerSource, compilerPublished, onModeChange, sourceCatalogue, modeled = false, methodUrl, credit, statusNote }: {
  directory?: string; structureDirectory?: string; observationStructures?: string; observationManifest?: string; kinematicsSource?: string; jointFitSource?: string; compilerSource?: string; compilerPublished?: string; onModeChange?(mode: 'sources' | 'structure' | 'volume'): void;
  sourceCatalogue?: string; modeled?: boolean; methodUrl?: string; credit?: string; statusNote?: string;
}) {
  const [mode, setMode] = useState<'sources' | 'structure' | 'volume' | 'combined' | 'kinematics' | 'joint' | 'compiler'>(() => {
    const requested = new URLSearchParams(location.search).get('inspection');
    if (compilerSource && observationStructures && (requested === 'compiler' || !requested && !new URLSearchParams(location.search).has('fit'))) return 'compiler';
    if (requested === 'combined' && observationStructures) return 'combined';
    if (requested === 'kinematics' && kinematicsSource) return 'kinematics';
    if (requested === 'joint' && jointFitSource && observationStructures) return 'joint';
    return requested === 'sources' && sourceCatalogue ? 'sources' : 'structure';
  });
  const structureMode = Boolean(observationStructures || structureDirectory) && mode === 'structure';
  const sourcesMode = Boolean(sourceCatalogue) && mode === 'sources';
  const combinedMode = mode === 'combined' && Boolean(observationStructures), velocityMode = mode === 'kinematics' && Boolean(kinematicsSource);
  const jointMode = mode === 'joint' && Boolean(jointFitSource && observationStructures);
  const compilerMode = mode === 'compiler', advanced = combinedMode || velocityMode || jointMode || compilerMode;
  function changeMode(next: typeof mode) {
    setMode(next); onModeChange?.(next === 'combined' || next === 'kinematics' || next === 'joint' || next === 'compiler' ? 'structure' : next);
    const url = new URL(location.href); url.searchParams.set('inspection', next); history.replaceState(history.state, '', url);
  }
  return <aside className={`floating-panel cloud-adjustment-panel${(structureMode && observationStructures || advanced) ? ' observation-structures-panel' : ''}`} aria-label="Emission inference comparison">
    {(structureDirectory || observationStructures) && <div className="emission-view-buttons" role="group" aria-label="Inspection mode">
      {compilerSource && observationStructures && <button type="button" aria-pressed={compilerMode} onClick={() => changeMode('compiler')}>Nebula</button>}
      {sourceCatalogue && <button type="button" aria-pressed={sourcesMode} onClick={() => changeMode('sources')}>Source candidates</button>}
      <button type="button" aria-pressed={structureMode} onClick={() => changeMode('structure')}>Structure map</button>
      {observationStructures && <button type="button" aria-pressed={combinedMode} onClick={() => changeMode('combined')}>Combined</button>}
      {kinematicsSource && <button type="button" aria-pressed={velocityMode} onClick={() => changeMode('kinematics')}>Velocity</button>}
      {jointFitSource && observationStructures && <button type="button" aria-pressed={jointMode} onClick={() => changeMode('joint')}>Joint fit</button>}
      {directory && <button type="button" aria-pressed={!structureMode && !sourcesMode && !advanced} title="Earlier volume baseline; retained for comparison." onClick={() => changeMode('volume')}>Volume</button>}
    </div>}
    {compilerMode && compilerSource && observationStructures ? <CompilerPanel recipePath={compilerSource} cataloguePath={observationStructures} observationManifest={observationManifest} publishedPath={compilerPublished} /> : jointMode && jointFitSource && observationStructures ? <JointFitPanel cataloguePath={observationStructures} recipePath={jointFitSource} observationManifest={observationManifest} /> : combinedMode && observationStructures ? <EvidenceFusion cataloguePath={observationStructures} observationManifest={observationManifest} /> : velocityMode && kinematicsSource ? <KinematicsPanel sourcePath={kinematicsSource} /> : sourcesMode && sourceCatalogue ? <EmissionSources key={sourceCatalogue} catalogue={sourceCatalogue} /> : structureMode && observationStructures ? <ObservationStructures key={observationStructures} cataloguePath={observationStructures} observationManifest={observationManifest} /> : structureMode && structureDirectory ? <EmissionStructures key={structureDirectory} directory={structureDirectory} /> : directory ? <fieldset>
      <legend>{modeled ? 'Image + geometric prior' : 'Image → inferred volume'}</legend>
      {observationStructures && <p className="interaction-hint">Previous Hubble baseline</p>}
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
    </fieldset> : <p role="status">No baseline volume is configured.</p>}
    {directory && !structureMode && !sourcesMode && !advanced && <a className="model-source" href={methodUrl ?? 'https://doi.org/10.1111/cgf.12216'} target="_blank" rel="noreferrer">Reconstruction paper ↗</a>}
    {!sourcesMode && !advanced && !(structureMode && observationStructures) && credit && <p className="interaction-hint">{credit}</p>}
  </aside>;
}
