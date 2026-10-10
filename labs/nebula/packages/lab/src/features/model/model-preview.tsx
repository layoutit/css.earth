/** The Model step's controls: one method dropdown and **Build** (`model <id> --method <m>`), the method's result over
 * its picture (**Result**), and the other previews: the bank's surfaces in the viewport, the published outlines on the
 * photograph, and the solvers configured for this nebula (Velocity, Joint fit). A solver that is not configured is not
 * offered. */
import { useCallback, useEffect, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { BigButton, BigButtons, StepRow, StepSection } from '../../ui/step-panel';
import { InfoTip } from '../../ui/info-tip';
import { KinematicsPanel } from '../kinematics/kinematics-panel';
import { JointFitPanel } from '../joint-fit/joint-fit-panel';
import { runLabCommand } from '../../ui/lab-run';
import { ModelResult } from './model-result';
import type { LabModel } from '../../server/workflows/model/model-output.ts';

export type Preview = 'surfaces' | 'outlines' | 'velocity' | 'joint' | 'result';
export type ModelMethod = 'paper-surfaces' | 'symmetry' | 'kinematic';
export interface Solvers { kinematics?: string; jointFit?: { recipe: string; structures: string; observations: string }; symmetry?: string }
/** Whether a preview replaces the viewport (a solver draws its own chart and camera; a result its picture). */
export const solverPreview = (preview: Preview) => preview === 'velocity' || preview === 'joint' || preview === 'result';
const METHODS: [ModelMethod, string][] = [['paper-surfaces', 'Paper surfaces'], ['symmetry', 'Symmetry (revolve)'], ['kinematic', 'Kinematic (slit fit)']];

type Results = Partial<Record<ModelMethod, LabModel | { error: string }>>;
/** The object's last result of each method, re-read after a build. */
function useModelResults(object: string) {
  const [results, setResults] = useState<Results>({}), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/__nebula/model?object=${encodeURIComponent(object)}`, { cache: 'no-store', signal: controller.signal }).then(response => response.json())
      .then((body: unknown) => { if (isRecord(body) && isRecord(body.results)) setResults(body.results as Results); }).catch(() => {});
    return () => controller.abort();
  }, [object, version]);
  return { results, reload: useCallback(() => setVersion(value => value + 1), []) };
}

export function ModelPreview({ object, solvers, preview, onPreview, outlines, busy, defaultMethod }: { object: string; solvers?: Solvers; preview: Preview; onPreview(preview: Preview): void;
  outlines: boolean; busy: boolean; defaultMethod: ModelMethod }) {
  const id = object.replace(/^src\/objects\//, '');
  const { results, reload } = useModelResults(id);
  const [method, setMethod] = useState<ModelMethod>(defaultMethod), [running, setRunning] = useState(false), [error, setError] = useState('');
  useEffect(() => { setMethod(defaultMethod); setError(''); }, [id, defaultMethod]);
  const result = results[method], built = result && !('error' in result) ? result : null;
  const build = () => { setRunning(true); setError('');
    void runLabCommand({ command: 'model', object: id, method }).then(() => { reload(); onPreview('result'); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setRunning(false)); };
  const options: [Preview, string, string][] = [['surfaces', '◉', 'Surfaces'], ['result', '▣', 'Result'],
    ...(outlines ? [['outlines', '◎', 'Outlines'] as [Preview, string, string]] : []),
    ...(solvers?.kinematics ? [['velocity', '↔', 'Velocity'] as [Preview, string, string]] : []),
    ...(solvers?.jointFit ? [['joint', '⋈', 'Joint fit'] as [Preview, string, string]] : [])];
  return <>
    <div className="step-field"><label htmlFor="model-method">Method</label>
      <select id="model-method" value={method} onChange={event => setMethod(event.currentTarget.value as ModelMethod)} disabled={running}>
        {METHODS.map(([value, label]) => <option key={value} value={value}>{label}{results[value] && !('error' in results[value]!) ? ' ✓' : ''}</option>)}
      </select></div>
    <BigButtons label="Build" columns={1}>
      <BigButton id="model-build" icon="⚙" label={running ? 'Building…' : built ? 'Build again' : 'Build'} primary={!built} disabled={running} onClick={build} title={`run.mts model ${id} --method ${method}`} />
    </BigButtons>
    {(error || result && 'error' in result) && <StepRow label="Error" state="fail">{error || (result as { error: string }).error}</StepRow>}
    <BigButtons label="Preview" columns={Math.min(options.length, 5)}>
      {options.map(([value, icon, label]) => <BigButton key={value} icon={icon} label={label} pressed={preview === value} disabled={busy && !solverPreview(value) || value === 'result' && !built}
        data={{ 'data-preview': value }} onClick={() => onPreview(value)} />)}
    </BigButtons>
    {preview === 'result' && built && <ModelSummary model={built} />}
    {preview === 'result' && built && <ModelResult model={built} />}
    {preview === 'velocity' && solvers?.kinematics && <KinematicsPanel sourcePath={solvers.kinematics} />}
    {preview === 'joint' && solvers?.jointFit && <JointFitPanel cataloguePath={solvers.jointFit.structures} recipePath={solvers.jointFit.recipe} observationManifest={solvers.jointFit.observations} />}
  </>;
}

/** The result's numbers: one row per surface, its metrics, its files and its limits, one line each. */
function ModelSummary({ model }: { model: LabModel }) {
  return <StepSection title="Result">
    {model.surfaces.map(surface => <StepRow key={surface.kind + surface.label} label={surface.label}>
      {Object.entries(surface.values).map(([key, value]) => `${key} ${value}`).join(' · ')}</StepRow>)}
    <StepRow label="Metrics">{Object.entries(model.metrics).filter(([, value]) => value !== null).map(([key, value]) => `${key} ${value}`).join(' · ')}</StepRow>
    {model.files.length > 0 && <StepRow label="Files">{model.files.map(file => file.split('/').at(-1)).join(' · ')}</StepRow>}
    {model.notes.length > 0 && <StepRow label="Limits">{model.notes.length} noted{' '}
      <InfoTip content={model.notes.join(' · ')}><span className="step-info" tabIndex={0} data-model-notes>ⓘ</span></InfoTip></StepRow>}
    <StepRow label="Built">{new Date(model.createdAt).toLocaleString()}</StepRow>
  </StepSection>;
}
