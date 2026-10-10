/** The Research step: the object's `source/research.json` (written by `research <id>`), read-only. Big status chips,
 * short labels and links; the detail is in the object README behind ⓘ. */
import { useCallback, useEffect, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { BigButton, BigButtons, SmallLinks, StepPanel, StepRow, StepSection } from '../../ui/step-panel';
import { localFile, subjects } from '../legacy-viewer/controller';
import { readmeUrl } from '../plates/plates-panel';
import { runLabCommand } from '../../ui/lab-run';
import type { ResearchRecord, VelocityItem } from '../../server/workflows/research/research.ts';

const METHOD_LABEL: Record<string, string> = { 'paper-surfaces': 'Paper surfaces', symmetry: 'Symmetry', kinematic: 'Kinematic', inference: 'Inference', density: 'Density' };
const STATUS_LABEL: Record<string, string> = { published: 'Published', experiment: 'Experiment', open: 'Open' };
const VELOCITY_LABEL: Record<VelocityItem['kind'], string> = { 'doppler-table': 'Doppler', 'long-slit': 'Long slit', ifu: 'IFU', echelle: 'Echelle', molecular: 'Molecular', mentioned: 'Spectra' };
const link = (url: string) => /^https?:/.test(url) ? url : localFile(url);

export function ResearchPanel({ subjectId }: { subjectId: string }) {
  const subject = subjects.find(item => item.id === subjectId), object = subject?.plates?.object ?? subject?.siteVolume?.object ?? subject?.directory;
  const id = object?.replace(/^src\/objects\//, '') ?? '';
  const [record, setRecord] = useState<ResearchRecord | null>(null), [missing, setMissing] = useState(false), [error, setError] = useState(''), [running, setRunning] = useState(false);
  const read = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/__nebula/research?object=${encodeURIComponent(id)}`, { cache: 'no-store', signal });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body)) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `research unavailable (${response.status}).`);
    setMissing(Boolean(body.missing)); setRecord(isRecord(body.record) ? body.record as unknown as ResearchRecord : null);
  }, [id]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setRecord(null); setError(''); setMissing(false);
    read(controller.signal).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => controller.abort();
  }, [id, read]);
  const run = () => { setRunning(true); setError('');
    void runLabCommand({ command: 'research', object: id }).then(() => read()).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setRunning(false)); };
  if (!subject || !object) return null;
  const messier = /^m\d+$/.test(subject.sourceSubjectId ?? subject.id) ? subject.sourceSubjectId ?? subject.id : null;
  const r = record;
  return <StepPanel label="Research" wide data-research={object} data-research-state={r ? 'ready' : missing ? 'missing' : error ? 'error' : 'loading'}>
    <StepSection title="Status" info={{ url: readmeUrl(object), label: 'Sources and evidence: the object README' }}>
      {r ? <div className="step-chips" data-research-chips>
        <span className="step-chip" data-tone={r.method.status === 'published' ? 'ok' : 'warn'} data-chip="method">{METHOD_LABEL[r.method.chosen]} <small>{STATUS_LABEL[r.method.status]}</small></span>
        <span className="step-chip" data-tone={r.models.length ? 'ok' : 'none'} data-chip="models">3D model <small>{r.models.length ? 'yes' : 'no'}</small></span>
        <span className="step-chip" data-tone={r.velocity.available ? 'ok' : 'none'} data-chip="velocity">Velocity <small>{r.velocity.available ? [...new Set(r.velocity.items.map(item => VELOCITY_LABEL[item.kind]))].join(' · ') : 'none'}</small></span>
        <span className="step-chip" data-tone={r.symmetry.kind === 'none' ? 'none' : 'ok'} data-chip="symmetry">{r.symmetry.kind === 'axial' ? 'Axial' : r.symmetry.kind === 'published-surfaces' ? 'Surfaces' : 'No symmetry'}</span>
      </div> : missing ? <span className="step-muted">No research.json yet</span> : error ? <StepRow label="Error" state="fail">{error}</StepRow> : <span className="step-muted">Reading…</span>}
      <BigButtons label="Research" columns={1}>
        <BigButton id="research-run" icon="⟳" label={running ? 'Researching…' : r ? 'Run research again' : 'Run research'} primary={!r} disabled={running} onClick={run}
          title={`run.mts research ${id}`} />
      </BigButtons>
    </StepSection>
    {r && <StepSection title="Checklist">
      <StepRow label="Type" data-research-row="type">{r.type}</StepRow>
      <StepRow label="Papers" data-research-row="papers" state={r.papers.length ? 'ok' : undefined}><SmallLinks links={r.papers.map(item => ({ label: item.label, url: link(item.url) }))} /></StepRow>
      <StepRow label="3D models" data-research-row="models" state={r.models.length ? 'ok' : undefined}><SmallLinks links={r.models.map(item => ({ label: item.label, url: link(item.url) }))} /></StepRow>
      <StepRow label="Images" data-research-row="images" state={r.images.length ? 'ok' : undefined}><SmallLinks links={r.images.map(item => ({ label: item.label, url: link(item.url) }))} /></StepRow>
      <StepRow label="Velocity" data-research-row="velocity" state={r.velocity.available ? 'ok' : undefined}>
        <SmallLinks links={r.velocity.items.map(item => ({ label: item.label, url: link(item.url ?? item.path ?? `${object}/README.md`) }))} /></StepRow>
      <StepRow label="Symmetry" data-research-row="symmetry">{r.symmetry.label}</StepRow>
      <StepRow label="Methods" data-research-row="methods">{r.method.available.map(method => METHOD_LABEL[method]).join(' · ') || 'None yet'}</StepRow>
      {messier && <StepRow label="Archive"><a href={`/catalogue?subject=${messier}`}>Messier archive ↗</a></StepRow>}
    </StepSection>}
  </StepPanel>;
}
