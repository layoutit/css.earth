import { useCallback, useEffect, useMemo, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { InfoTip } from '../../ui/info-tip';
import { BigButton, BigButtons, SmallLinks, StepPanel, StepRow, StepSection } from '../../ui/step-panel';
import { ImageCredit } from '../workspace/image-credit';
import { localFile, subjects } from '../legacy-viewer/controller';
import { selectBank, selectedBank } from '../legacy-viewer/bank-selection';
import type { LabStep } from '../legacy-viewer/lab-routing';
import { citation, geometryFields, readPlateRecipe, readPublication, type GeometryField, type PlateRecipe, type Publication } from './plates-model.ts';
import { PlateModelOverlay, usePlateModel } from './plate-model-overlay';
import type { LabControlsProps } from '../../state/use-lab-controller';
import { usePlates } from './plates-state.ts';
import { platesDirectory } from './plates-paths.ts';
import type { PlateBakeReceipt } from './plates-receipt.ts';
import { useViewerOpenTime } from './viewer-open-time.ts';
import { NebulaLensSelect } from './nebula-lenses';
import { CandidateOutline, useCandidatePictures } from './candidate-pictures';
import { CompareWith, useCandidateModels, type CompareValue } from './candidate-models-panel';
import type { CandidateModelState } from './candidate-models';
import { SiteWorkspaceTools } from './site-tools';
import { ModelPreview, type Preview } from '../model/model-preview';
import '../compiler/compiler.css';
import './plates.css';

type PlateSubject = (typeof subjects)[number] & { plates: { group: string; object: string } };
const isPlateSubject = (subject: (typeof subjects)[number] | undefined): subject is PlateSubject => Boolean(subject?.plates);
type Shown = 'checkout' | 'draft';

export async function readJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(localFile(path), { cache: 'no-store', signal });
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`${path} is unavailable (${response.status}).`);
  return response.json();
}
const arcsec = (value: number) => `${Math.round(value)}″`;
const shownOf = (subject: PlateSubject): Shown => selectedBank(subject).directory === platesDirectory(subject.plates.object) ? 'draft' : 'checkout';
export const readmeUrl = (object: string) => localFile(`${object}/README.md`);

interface StepProps { step: LabStep; preview: Preview; onPreview(preview: Preview): void }
/** Published plates: a registered photograph on a nebula's published surfaces, worked on where the site keeps it.
 * One session per object holds its working copy and jobs across the Model, Edit and Bake & publish steps. */
export function PlatesPanel({ subjectId, busy, onReload, shell, controller, ...step }: { subjectId: string; busy: boolean; onReload(id: string): void } & LabControlsProps & StepProps) {
  const subject = subjects.find(item => item.id === subjectId);
  if (!isPlateSubject(subject)) return null;
  return <PlatesSession key={subject.id} subject={subject} busy={busy} onReload={onReload} shell={shell} controller={controller} {...step} />;
}

/** Show: the model alone, or the photograph (with its stars, or the star-free copy the bake read) on the registered plane. */
type ShowChoice = 'model' | 'original' | 'starless';

function PlatesSession({ subject, busy, onReload, shell, controller, step, preview, onPreview }: { subject: PlateSubject; busy: boolean; onReload(id: string): void } & LabControlsProps & StepProps) {
  const object = subject.plates.object;
  const [manifest, setManifest] = useState<unknown>(undefined);
  const [publications, setPublications] = useState(new Map<string, Publication>()), [confirmPublish, setConfirmPublish] = useState(false);
  const [shown, setShown] = useState<Shown>(() => shownOf(subject));
  useViewerOpenTime();
  const show = useCallback((next: Shown) => {
    setShown(next); selectBank(subject.id, next === 'checkout' ? null : { directory: platesDirectory(object) }); onReload(subject.id);
  }, [subject.id, object, onReload]);
  const plates = usePlates(object, useCallback((receipt: PlateBakeReceipt) => { if (receipt.quality !== 'publish') show(receipt.quality === 'draft' ? 'draft' : 'checkout'); }, [show]));
  const recipe = useMemo<PlateRecipe | null>(() => { try { return plates.recipe ? readPlateRecipe(plates.recipe, manifest) : null; } catch { return null; } }, [plates.recipe, manifest]);
  const fields = useMemo(() => geometryFields(plates.recipe), [plates.recipe]);
  const original = shell.originalOverlay;
  const originalReady = Boolean(original?.available && !original.loading && !busy);
  const pictures = useCandidatePictures(object), models = useCandidateModels(object);
  const [modelState, setModelState] = useState<CandidateModelState>({ ids: [], shock: false, texture: 'auto' });
  const applyModels = (next: CandidateModelState) => { setModelState(next); void controller.current?.setCandidateModels(next); };
  // A reloaded subject drops the mounted layers; show the chosen ones again.
  useEffect(() => { if (!busy && (modelState.ids.length || modelState.shock)) void controller.current?.setCandidateModels(modelState); }, [subject.id, busy]);
  const shownCandidate = original?.enabled && original.picture?.startsWith('candidate:') ? pictures.find(item => `candidate:${item.id}` === original.picture) ?? null : null;
  const showChoice: ShowChoice = !original?.enabled || shownCandidate ? 'model' : original.picture === 'starless' ? 'starless' : 'original';
  const compare: CompareValue = shownCandidate ? `picture:${shownCandidate.id}` : modelState.ids.length === 1 ? `model:${modelState.ids[0]!}` : '';
  const outlines = step === 'model' && preview === 'outlines';
  const modelShown = Boolean(outlines && original?.enabled && original.picture === 'original');
  const model = usePlateModel(recipe, plates.recipe, object, modelShown);
  // The outlines are drawn inside the registered original plane the viewer mounts; it exists once the plane has loaded.
  const [plane, setPlane] = useState<HTMLElement | null>(null);
  useEffect(() => { setPlane(original?.enabled && !original.loading ? document.querySelector<HTMLElement>('#viewer [data-reconstruction-original-leaf]') : null); },
    [original?.enabled, original?.loading, original?.picture, shell.subjectId]);
  const choose = (next: ShowChoice) => {
    if (!originalReady) return;
    if (next === 'model') void controller.current?.showOriginalPicture(false, original?.picture === 'starless' ? 'starless' : 'original');
    else void controller.current?.showOriginalPicture(true, next);
  };
  const chooseCompare = (next: CompareValue) => {
    if (next.startsWith('picture:')) {
      if (modelState.ids.length) applyModels({ ...modelState, ids: [] });
      if (originalReady) void controller.current?.showOriginalPicture(true, `candidate:${next.slice('picture:'.length)}`);
    } else {
      if (shownCandidate && originalReady) void controller.current?.showOriginalPicture(false, 'original');
      applyModels({ ...modelState, ids: next ? [next.slice('model:'.length)] : [] });
    }
  };
  // The outlines preview needs the photograph on its plane.
  useEffect(() => { if (outlines && originalReady && (!original?.enabled || original.picture !== 'original')) void controller.current?.showOriginalPicture(true, 'original'); },
    [outlines, originalReady]);
  const sources = useMemo(() => [...new Set(recipe?.geometry.map(item => item.source).filter(Boolean) ?? [])].join(','), [recipe]);
  useEffect(() => {
    const controller = new AbortController();
    void readJson(`${object}/source/manifest.json`, controller.signal).then(setManifest).catch(() => setManifest(undefined));
    return () => controller.abort();
  }, [object]);
  useEffect(() => {
    const controller = new AbortController(), papers = new Map<string, Publication>();
    void (async () => {
      for (const source of sources.split(',').filter(Boolean)) {
        const record = await readJson(`src/sources/${source}.json`, controller.signal).catch(() => null);
        if (record) try { papers.set(source, readPublication(record)); } catch { /* A non-publication source is named by its id. */ }
      }
      if (!controller.signal.aborted) setPublications(papers);
    })();
    return () => controller.abort();
  }, [sources]);
  const working = plates.busy.full ? 'full' : plates.busy.publish ? 'publish' : plates.busy.draft ? 'draft' : null;
  const jobLine = working ? `${working === 'full' ? 'Full bake' : working === 'publish' ? 'Publishing' : 'Draft bake'} · ${plates.jobs[working]?.progress?.message ?? 'queued'}` : '';
  const readme = readmeUrl(object);
  const compareControl = <CompareWith value={compare} pictures={pictures} models={models} modelState={modelState} busy={busy || !originalReady && !models.length}
    onChange={chooseCompare} onModelState={applyModels} />;
  const credit = <ImageCredit credit={recipe?.photograph.credit} />;
  const data = { 'data-plates-object': object, 'data-plates-shown': shown, 'data-plates-draft-busy': plates.busy.draft, 'data-plates-full-busy': plates.busy.full, 'data-plates-edits': plates.edits };

  // Research shows its own panel; the session (working copy, jobs, compared model) stays alive behind it.
  if (step === 'research') return null;
  if (step === 'model') return <StepPanel label="Model" {...data}>
    <StepSection title="Method" info={{ url: readme, label: 'Method and sources: the object README' }}>
      <StepRow label="Method">Published plates</StepRow>
      <ModelPreview object={object} defaultMethod="paper-surfaces" solvers={subject.solvers} preview={preview} onPreview={onPreview} outlines={Boolean(recipe && !recipe.cropped)} busy={busy} />
    </StepSection>
    {(preview === 'surfaces' || preview === 'outlines') && <>
      {recipe && <Geometry recipe={recipe} publications={publications} />}
      {(pictures.length > 0 || models.length > 0) && <StepSection title="Compare">{compareControl}</StepSection>}
      {outlines && model.table && <StepRow label="Speeds">{model.measured && 'points' in model.measured ? `${model.measured.points.length.toLocaleString()} points · blue near, red far`
        : model.measured && 'error' in model.measured ? model.measured.error : 'Reading…'}</StepRow>}
    </>}
    {modelShown && recipe && plane && <PlateModelOverlay recipe={recipe} plane={plane} model={model} />}
    {credit}
  </StepPanel>;

  if (step === 'bake') return <StepPanel label="Bake and publish" {...data}>
    <BakeAndPublish object={object} plates={plates} working={working} jobLine={jobLine} confirmPublish={confirmPublish} setConfirmPublish={setConfirmPublish} />
    {credit}
  </StepPanel>;

  // Edit: the viewport, a few toggles and the geometry, on a working copy.
  return <StepPanel label="Edit" {...data}>
    <StepSection title="View">
      <div className="step-field"><label htmlFor="nebula-lens">Dataset</label><NebulaLensSelect subjectId={subject.id} busy={busy} onReload={onReload} /></div>
      <BigButtons label="Show" columns={3}>
        {([['model', '◎', 'Model'], ['original', '▧', 'Original'], ['starless', '☁', 'Starless']] as const).map(([id, icon, label]) =>
          <BigButton key={id} label={label} icon={icon} pressed={showChoice === id} data={{ 'data-show': id }}
            disabled={!originalReady || id === 'starless' && !recipe?.pictures.starless}
            title={id === 'starless' && !recipe?.pictures.starless ? recipe?.pictures.starlessReason ?? 'No star-free copy.' : undefined} onClick={() => choose(id)} />)}
      </BigButtons>
      {compareControl}
      <div className="step-field step-field-range">
        <label htmlFor="plates-original-opacity">Opacity</label>
        <input id="plates-original-opacity" type="range" min="0" max="100" step="1" value={(original?.opacity ?? .5) * 100}
          disabled={!original?.enabled} onChange={event => void controller.current?.setOriginalOpacity(event.currentTarget.valueAsNumber / 100)} />
        <output htmlFor="plates-original-opacity">{Math.round((original?.opacity ?? .5) * 100)}%</output>
      </div>
      {original?.loading && <span className="step-status" role="status">Loading image…</span>}
    </StepSection>
    {shownCandidate && plane && <CandidateOutline candidate={shownCandidate} plane={plane} />}
    <StepSection title="Working copy">
      <div className="step-working-copy" role="group" aria-label="Unsaved changes" data-working-changes={plates.changes.length}>
        <span>{plates.changes.length} change{plates.changes.length === 1 ? '' : 's'}{shown === 'draft' ? ' · draft' : ''}</span>
        <button type="button" className="step-button-primary" data-working-save disabled={!plates.changes.length} onClick={() => void plates.save()}>Save</button>
        <button type="button" data-working-discard disabled={!plates.changes.length}
          onClick={() => { void plates.discard().then(() => { if (shown !== 'checkout') show('checkout'); }); }}>Discard</button>
      </div>
      {(plates.error || jobLine) && <div className="step-status" role={plates.error ? 'alert' : 'status'} data-error={Boolean(plates.error)}>{plates.error || jobLine}</div>}
    </StepSection>
    {recipe && <GeometryEditor fields={fields} onEdit={(field, value) => { if (Number.isFinite(value)) plates.edit(field.path, value); }}
      snapshot={plates.snapshot} undoable={plates.undoable} onUndo={plates.undo} onResetGeometry={to => void plates.resetGeometry(to)} />}
    <SiteWorkspaceTools kind="plates" object={object} dataset="" picture={original?.picture === 'starless' ? 'starless' : 'original'} shell={shell} controller={controller} />
    {credit}
  </StepPanel>;
}

type Plates = ReturnType<typeof usePlates>;
interface Verified { ok: boolean; checks: { name: string; ok: boolean; message: string }[] }
/** Bake & publish: status against git, the draft and full bakes, `verify`, the files changed, R2 and Publish. Every
 * button runs the same function as the CLI's `bake`, `verify` and `publish`; runs show in the progress strip. */
function BakeAndPublish({ object, plates, working, jobLine, confirmPublish, setConfirmPublish }: { object: string; plates: Plates; working: string | null; jobLine: string;
  confirmPublish: boolean; setConfirmPublish(value: boolean): void }) {
  const [verified, setVerified] = useState<Verified | 'checking' | { error: string } | null>(null);
  const verify = useCallback(() => {
    setVerified('checking');
    void fetch(`/__nebula/plate-verify?object=${encodeURIComponent(object)}`, { cache: 'no-store' }).then(async response => {
      const value: unknown = await response.json();
      if (!response.ok || !isRecord(value) || !Array.isArray(value.checks)) throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : `verify failed (${response.status}).`);
      setVerified(value as unknown as Verified);
    }).catch((reason: unknown) => setVerified({ error: reason instanceof Error ? reason.message : String(reason) }));
  }, [object]);
  // A finished bake changes what verify reports.
  const doneAt = [plates.receipts.draft?.seconds, plates.receipts.full?.seconds].join();
  useEffect(() => { verify(); }, [verify, doneAt]);
  const status = plates.status, published = plates.published;
  return <>
    <StepSection title="Status">
      <StepRow label="Git" data-ship-row="git" state={status ? status.changed.length ? undefined : 'ok' : undefined}>
        {status ? status.changed.length ? `${status.changed.length} file${status.changed.length === 1 ? '' : 's'} changed` : 'No change' : 'Reading…'}</StepRow>
      <StepRow label="Unsaved" state={plates.changes.length ? undefined : 'ok'}>{plates.changes.length ? `${plates.changes.length} change${plates.changes.length === 1 ? '' : 's'} (Edit → Save)` : 'None'}</StepRow>
      <StepRow label="R2" data-ship-row="r2" state={published && published !== 'checking' ? published.ok ? 'ok' : 'fail' : undefined}>
        {published === null ? 'Not checked' : published === 'checking' ? 'Checking…' : published.message}</StepRow>
    </StepSection>
    <StepSection title="Bake">
      <BigButtons label="Bake" columns={3}>
        <BigButton id="bake-draft" icon="◔" label="Draft bake" disabled={Boolean(plates.busy.draft || plates.busy.full || plates.busy.publish)} onClick={() => plates.start('draft')}
          title="bake <id> --draft: a coarse bake of the working copy into .local/lab/draft." />
        <BigButton id="bake-full" icon="●" label="Full bake" primary disabled={Boolean(plates.busy.full || plates.busy.publish)} onClick={() => plates.start('full')}
          title="bake <id>: the site's own preparation of this object, in place." />
        {working && working !== 'publish' ? <BigButton id="bake-cancel" icon="■" label="Cancel" onClick={() => plates.cancel(working as 'draft' | 'full')} />
          : <BigButton id="verify" icon="✓" label="Verify" disabled={verified === 'checking'} onClick={verify} title="verify <id>" />}
      </BigButtons>
      {(plates.error || jobLine) && <div className="step-status" role={plates.error ? 'alert' : 'status'} data-error={Boolean(plates.error)}>{plates.error || jobLine}</div>}
    </StepSection>
    <StepSection title="Verify">
      {verified === null || verified === 'checking' ? <StepRow label="verify">Checking…</StepRow>
        : 'error' in verified ? <StepRow label="verify" state="fail">{verified.error}</StepRow>
        : verified.checks.map(check => <StepRow key={check.name} label={check.name} state={check.ok ? 'ok' : 'fail'} data-verify-check={check.name}>{check.message}</StepRow>)}
    </StepSection>
    <StepSection title="Files changed">
      {status?.changed.length ? <ul className="step-files">{status.changed.map(path => <li key={path}><code>{path.replace('src/objects/', '')}</code></li>)}</ul>
        : <span className="step-muted">{status ? 'None' : 'Reading…'}</span>}
    </StepSection>
    <StepSection title="Publish">
      {confirmPublish ? <div className="step-confirm">
        <button type="button" className="step-button-primary" id="publish-confirm" onClick={() => { setConfirmPublish(false); plates.start('publish'); }}>Publish to R2</button>
        <button type="button" onClick={() => setConfirmPublish(false)}>Cancel</button>
      </div> : <BigButtons label="Publish" columns={2}>
        <BigButton id="check-r2" icon="☁" label="Check R2" disabled={published === 'checking'} onClick={plates.checkPublished} />
        <BigButton id="publish" icon="⇪" label="Publish…" disabled={Boolean(plates.busy.publish || plates.busy.full)} onClick={() => setConfirmPublish(true)}
          title="Uploads this object's inventoried files to R2 (publish-runtime-assets). Asks first." />
      </BigButtons>}
    </StepSection>
  </>;
}

/** The published geometry: one row per plate, and the paper it comes from as a small link. */
function Geometry({ recipe, publications }: { recipe: PlateRecipe; publications: Map<string, Publication> }) {
  return <StepSection title="Geometry">
    {recipe.geometry.map(item => { const paper = publications.get(item.source);
      return <div key={item.kind} className="plates-geometry" data-geometry-kind={item.kind}>
        {item.plates.length > 0 && <table>
          <thead><tr><th>Plate</th><th>Radius</th><th>Tilt</th><th>Far side</th><th>Depth</th></tr></thead>
          <tbody>{item.plates.map(plate => <tr key={plate.id} data-plate={plate.id}>
            <th scope="row"><span className="plates-swatch" data-plate={plate.id} />{plate.label}</th>
            <td>{arcsec(plate.radiusArcsec)}</td><td>{Number(plate.tiltDeg.toFixed(1))}°</td><td>PA {Number(plate.farAxisPaDeg.toFixed(1))}°</td>
            <td>±{arcsec(plate.depthArcsec)}</td>
          </tr>)}</tbody>
        </table>}
        <StepRow label={item.kind}>
          <SmallLinks links={paper?.url ? [{ label: citation(paper), url: paper.url }] : []} />
          {item.basis && <InfoTip content={item.basis}><span className="step-info" tabIndex={0}>ⓘ</span></InfoTip>}
        </StepRow>
      </div>; })}
  </StepSection>;
}

/** The geometry sliders: they write the working copy; Reset, To committed and Undo put numbers back. */
function GeometryEditor({ fields, onEdit, snapshot, undoable, onUndo, onResetGeometry }: { fields: GeometryField[]; onEdit(field: GeometryField, value: number): void;
  snapshot: Record<string, number>; undoable: number; onUndo(): void; onResetGeometry(to: 'session' | 'committed'): void }) {
  const changed = fields.filter(field => field.path in snapshot && snapshot[field.path] !== field.value).length;
  // The published structures first; the bank's own frame numbers last.
  const groups = useMemo(() => [...new Set(fields.map(field => field.group))].sort((a, b) => Number(a === 'frame') - Number(b === 'frame')), [fields]);
  return <StepSection title="Geometry">
    <div className="compiler-actions plates-geometry-actions" data-geometry-changed={changed}>
      <button type="button" data-geometry-reset="session" disabled={!changed} title="The numbers as first loaded this session." onClick={() => onResetGeometry('session')}>Reset{changed ? ` (${changed})` : ''}</button>
      <button type="button" data-geometry-reset="committed" title="The numbers as committed (git)." onClick={() => onResetGeometry('committed')}>To committed</button>
      <button type="button" data-geometry-undo disabled={!undoable} onClick={onUndo}>Undo</button>
    </div>
    {groups.map(group => <div key={group} className="plates-editor-group">
      <div className="plates-editor-heading">{group}</div>
      {fields.filter(field => field.group === group).map(field => {
        const value = field.value;
        return <div key={field.path} className="plates-field" title={field.path} data-changed={field.path in snapshot && snapshot[field.path] !== value}>
          <label htmlFor={`plates-${field.path}`}>{field.key}</label>
          <input type="range" min={field.min} max={field.max} step={field.step} value={value} aria-label={`${field.key} slider`}
            onChange={event => onEdit(field, event.currentTarget.valueAsNumber)} />
          <input id={`plates-${field.path}`} type="number" step={field.step} value={Number(value.toPrecision(6))}
            onChange={event => onEdit(field, event.currentTarget.valueAsNumber)} />
        </div>;
      })}
    </div>)}
  </StepSection>;
}
