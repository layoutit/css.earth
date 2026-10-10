import { useEffect, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { BigButton, BigButtons, SmallLinks, StepPanel, StepRow, StepSection } from '../../ui/step-panel';
import { subjects } from '../legacy-viewer/controller';
import { selectedBank } from '../legacy-viewer/bank-selection';
import type { LabStep } from '../legacy-viewer/lab-routing';
import { labWorkflows, readLabWorkflow } from '../../state/lab-workflows.ts';
import { readJson, readmeUrl } from './plates-panel';
import { useViewerOpenTime } from './viewer-open-time.ts';
import { NebulaLensSelect } from './nebula-lenses';
import { SiteWorkspaceTools } from './site-tools';
import { ModelPreview, type Preview } from '../model/model-preview';
import './plates.css';
import type { LabControlsProps } from '../../state/use-lab-controller';

interface Dataset { id: string; label: string; sourceUrl?: string }
/** A nebula volume as the site ships it: its prepared dataset bank, one dataset at a time, in the shared viewer. Its
 * bake is the site's `prepare:nebulae`, run from the command line. */
export function SiteVolumePanel({ subjectId, busy, onReload, shell, controller, step, preview, onPreview }: { subjectId: string; busy: boolean; onReload(id: string): void;
  step: LabStep; preview: Preview; onPreview(preview: Preview): void } & LabControlsProps) {
  const subject = subjects.find(item => item.id === subjectId), object = subject?.siteVolume?.object;
  const [datasets, setDatasets] = useState<Dataset[]>([]), [defaultId, setDefaultId] = useState(''), [error, setError] = useState('');
  useViewerOpenTime();
  // Whether this dataset's lab workspace left a registered original in this checkout, and if not, why.
  const [missing, setMissing] = useState('');
  const probe = subject ? selectedBank(subject).dataset ?? (document.getElementById('viewer')?.dataset.bankDataset || defaultId) : '';
  useEffect(() => {
    if (!object || !probe) return;
    const controller = new AbortController();
    void fetch(`/__nebula/volume-original?probe=1&object=${encodeURIComponent(object)}&dataset=${encodeURIComponent(probe)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const body = await response.json() as { error?: string; missing?: string };
        if (!controller.signal.aborted) setMissing(!response.ok ? body.error ?? 'No registered original.' : body.missing ?? ''); })
      .catch(() => { if (!controller.signal.aborted) setMissing('The original could not be checked.'); });
    return () => controller.abort();
  }, [object, probe]);
  useEffect(() => {
    if (!object) return;
    const controller = new AbortController();
    void readJson(`${object}/prepared/datasets.json`, controller.signal).then(value => {
      const index = isRecord(value) && isRecord(value.data) ? value.data : null;
      if (!index || !Array.isArray(index.datasets) || typeof index.defaultDataset !== 'string') throw new TypeError(`${object}: unreadable dataset index.`);
      setDefaultId(index.defaultDataset);
      setDatasets(index.datasets.flatMap(item => isRecord(item) && typeof item.id === 'string' ? [{ id: item.id, label: typeof item.label === 'string' ? item.label : item.id,
        ...(typeof item.sourceUrl === 'string' ? { sourceUrl: item.sourceUrl } : {}) }] : []));
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => controller.abort();
  }, [object]);
  if (!subject || !object) return null;
  const chosen = selectedBank(subject).dataset ?? document.getElementById('viewer')?.dataset.bankDataset;
  const shown = datasets.find(item => item.id === (chosen || defaultId));
  const method = subject.workflow ? labWorkflows[readLabWorkflow(subject.workflow)].label : '';
  const original = shell.originalOverlay, originalReady = Boolean(original?.available && !original.loading && !busy && !missing);
  const readme = readmeUrl(object), id = object.slice('src/objects/'.length);
  const dataset = <div className="step-field"><label htmlFor="nebula-lens">Dataset</label><NebulaLensSelect subjectId={subject.id} busy={busy} onReload={onReload} /></div>;
  const errorRow = error && <StepRow label="Error" state="fail">{error}</StepRow>;

  if (step === 'research') return null;
  if (step === 'model') return <StepPanel label="Model" data-site-volume={object}>
    <StepSection title="Method" info={{ url: readme, label: 'Method, sources and limits: the object README' }}>
      <StepRow label="Method">{method || 'Prepared volume'}</StepRow>
      <StepRow label="Bank"><code>{id}/prepared</code></StepRow>
      {dataset}
      {shown?.sourceUrl && <StepRow label="Source"><SmallLinks links={[{ label: shown.label, url: shown.sourceUrl }]} /></StepRow>}
      <ModelPreview object={object} defaultMethod={subject.solvers?.symmetry ? 'symmetry' : subject.solvers?.kinematics ? 'kinematic' : 'paper-surfaces'} solvers={subject.solvers} preview={preview} onPreview={onPreview} outlines={false} busy={busy} />
    </StepSection>
    {errorRow}
  </StepPanel>;

  if (step === 'bake') return <StepPanel label="Bake and publish" data-site-volume={object}>
    <StepSection title="Bake" info={{ url: readme, label: 'Compact delivery inputs: the object README' }}>
      <StepRow label="Bake"><code>pnpm prepare:nebulae --object={id}</code></StepRow>
      <StepRow label="Publish"><code>pnpm publish:runtime-assets --object={id}</code></StepRow>
      <StepRow label="Lab">Volumes bake from the command line</StepRow>
    </StepSection>
    {errorRow}
  </StepPanel>;

  return <StepPanel label="Edit" data-site-volume={object}>
    <StepSection title="View">
      {dataset}
      <BigButtons label="Show" columns={3}>
        <BigButton label="Model" icon="◎" pressed={!original?.enabled} disabled={!originalReady && !original?.enabled} data={{ 'data-show': 'model' }}
          onClick={() => void controller.current?.showOriginal(false)} />
        <BigButton id="site-volume-original-enabled" label="Original" icon="▧" pressed={Boolean(original?.enabled)} disabled={!originalReady} data={{ 'data-show': 'original' }}
          title={originalReady ? undefined : original?.loading ? 'Loading the photograph.' : missing || 'No registered original for this dataset.'}
          onClick={() => void controller.current?.showOriginal(true)} />
        <BigButton label="Starless" icon="☁" disabled data={{ 'data-show': 'starless' }} title="Volumes keep no star-free photograph in the lab." onClick={() => {}} />
      </BigButtons>
      <div className="step-field step-field-range">
        <label htmlFor="site-volume-original-opacity">Opacity</label>
        <input id="site-volume-original-opacity" type="range" min="0" max="100" step="1" value={(original?.opacity ?? .5) * 100} disabled={!original?.enabled}
          onChange={event => void controller.current?.setOriginalOpacity(event.currentTarget.valueAsNumber / 100)} />
        <output htmlFor="site-volume-original-opacity">{Math.round((original?.opacity ?? .5) * 100)}%</output>
      </div>
    </StepSection>
    {errorRow}
    {(chosen || defaultId) && <SiteWorkspaceTools kind="volume" object={object} dataset={chosen || defaultId} picture="original" shell={shell} controller={controller} />}
  </StepPanel>;
}
