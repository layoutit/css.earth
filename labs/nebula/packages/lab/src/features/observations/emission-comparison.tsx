import { WorkspaceSections } from '../../pages/reconstruction/workspace-sections';
import '../workspace/workspace-controls.css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  const [mode, setMode] = useState<'sources' | 'structure' | 'volume' | 'combined' | 'kinematics' | 'joint' | 'compiler'>(() => {
    const requested = new URLSearchParams(location.search).get('inspection');
    if (compilerSource && observationStructures && (requested === 'compiler' || !requested && !new URLSearchParams(location.search).has('fit'))) return 'compiler';
    if (requested === 'volume' && directory) return 'volume';
    if (requested === 'combined' && observationStructures) return 'combined';
    if (requested === 'kinematics' && kinematicsSource) return 'kinematics';
    if (requested === 'joint' && jointFitSource && observationStructures) return 'joint';
    return requested === 'sources' && sourceCatalogue ? 'sources' : observationStructures || structureDirectory ? 'structure' : directory ? 'volume' : 'compiler';
  });
  const structureMode = Boolean(observationStructures || structureDirectory) && mode === 'structure';
  const sourcesMode = Boolean(sourceCatalogue) && mode === 'sources';
  const combinedMode = mode === 'combined' && Boolean(observationStructures), velocityMode = mode === 'kinematics' && Boolean(kinematicsSource);
  const jointMode = mode === 'joint' && Boolean(jointFitSource && observationStructures);
  const legacyModel = Boolean(directory && !compilerSource && !observationStructures && !structureDirectory);
  const compilerMode = mode === 'compiler', advanced = combinedMode || velocityMode || jointMode || compilerMode;
  function changeMode(next: typeof mode) {
    setMode(next); onModeChange?.(next === 'combined' || next === 'kinematics' || next === 'joint' || next === 'compiler' ? 'structure' : next);
    const url = new URL(location.href); url.searchParams.set('inspection', next); history.replaceState(history.state, '', url);
  }
  return <aside className={`floating-panel cloud-adjustment-panel${(structureMode && observationStructures || advanced) ? ' observation-structures-panel' : ''}`} aria-label="Emission inference comparison">
    <WorkspaceSections active={legacyModel && mode === 'volume' ? 'compiler' : mode} onChange={next => changeMode(legacyModel && next === 'compiler' ? 'volume' : next)} capabilities={{
      compiler: legacyModel || Boolean(compilerSource && observationStructures), sources: Boolean(sourceCatalogue),
      structure: Boolean(structureDirectory || observationStructures), combined: Boolean(observationStructures),
      kinematics: Boolean(kinematicsSource), joint: Boolean(jointFitSource && observationStructures), volume: Boolean(directory),
    }} />
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
    {host && (sourcesMode || structureMode && !observationStructures) && createPortal(
      <aside className="floating-panel workspace-model-panel" aria-label="Camera and model">
        <fieldset disabled title="This prepared image is fitted to the preview automatically."><legend>Camera</legend><p className="interaction-hint">Image fitted to view</p></fieldset>
        <fieldset className="workspace-model" disabled title="Source and structure inspection uses prepared images, without a volume model."><legend>Model</legend><p className="interaction-hint">Prepared image inspection · no volume</p></fieldset>
      </aside>, host)}
    {directory && !structureMode && !sourcesMode && !advanced && <a className="model-source" href={methodUrl ?? 'https://doi.org/10.1111/cgf.12216'} target="_blank" rel="noreferrer">Reconstruction paper ↗</a>}
    {!sourcesMode && !advanced && !(structureMode && observationStructures) && credit && <p className="interaction-hint">{credit}</p>}
  </aside>;
}
