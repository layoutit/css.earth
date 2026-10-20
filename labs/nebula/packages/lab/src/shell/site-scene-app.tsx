import { useCallback, useEffect, useState } from 'react';
import { useSiteLabController } from '../state/use-lab-controller';
import { labObjects } from './site-lab';
import { subjects } from '../features/legacy-viewer/subject-catalogue';
import { SiteSceneView } from '../features/site-scene/site-scene-view';
import { SiteDatasetSelect } from '../features/site-scene/site-dataset-select';
import { LayerToggles } from '../features/site-scene/layer-toggles';
import { readLabLayers, writeLabLayers } from '../features/site-scene/lab-layers';
import { isAppDatasetId } from '../features/site-scene/site-scene-url';
import type { SiteBridge } from '../features/site-scene/site-bridge';
import type { WorldLayer } from '@cssearth/renderer/universe/world-layers.ts';
import { SiteCameraPanel } from '../ui/camera-panel';
import { StepPanel, StepSection } from '../ui/step-panel';

/** A site-owned scene beside the existing source-alignment and reconstruction workspaces. */
export function SiteSceneApp() {
  const query = new URL(location.href).searchParams, requested = query.get('subject') ?? query.get('object');
  if (requested && !subjects.find(subject => subject.id === requested)?.app)
    return <p role="alert">No site scene is configured for this subject. <a href={`/alignment?subject=${encodeURIComponent(requested)}`}>Inspect original sources</a></p>;
  return <SiteSceneWorkspace />;
}

function SiteSceneWorkspace() {
  const { shell, controller } = useSiteLabController();
  const [bridge, setBridge] = useState<SiteBridge | null>(null);
  const [hidden, setHidden] = useState<WorldLayer[]>(() => readLabLayers(new URL(location.href)));
  const onBridge = useCallback((next: SiteBridge | null) => setBridge(next), []);
  useEffect(() => { controller.current?.attach(bridge); }, [bridge, controller, shell.objectId]);
  const subject = subjects.find(item => item.id === shell.objectId), app = subject?.app;
  const query = new URL(location.href).searchParams, linkedDataset = query.get('dataset') ?? app?.dataset, view = query.get('view');
  const reported = shell.site?.hidden;
  useEffect(() => {
    if (reported) { setHidden([...reported]); writeLabLayers(reported); }
  }, [reported]);
  const run = (promise: Promise<unknown> | undefined) => { void promise?.catch(() => {}); };
  return <>
    <header className="lab-header">
      <label>Object <select aria-label="Object" value={shell.objectId} onChange={event => controller.current?.changeObject(event.currentTarget.value)}>
        {labObjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <a href={`/alignment?subject=${shell.objectId}`}>Original sources</a>
      <a href={`/reconstruction?subject=${shell.objectId}`}>Reconstruction</a>
    </header>
    <main className="lab-layout" data-lab-step="edit">
      <section className="lab-workspace" aria-label="Site scene inspection"><div className="workspace-content">
        <div id="render-panel" role="region" aria-label="Site renderer">
          {app && subject && <SiteSceneView key={app.object} object={app.object} name={subject.name} hidden={hidden} onBridge={onBridge}
            {...(linkedDataset && isAppDatasetId(linkedDataset) ? { dataset: linkedDataset } : {})}
            {...(view && /^[A-Za-z0-9_-]{3,5462}$/u.test(view) ? { view } : {})} />}
          <div id="viewer" data-site-scene="" aria-label="Lab layers over the site scene" aria-busy={shell.busy} />
          <LayerToggles hidden={hidden} disabled={!shell.site?.ready} onChange={next => {
            setHidden(next); writeLabLayers(next); run(controller.current?.setLayers(next));
          }} />
        </div>
        <SiteCameraPanel shell={shell} controller={controller} />
        <StepPanel label="Site scene"><StepSection title="View">
          <div className="step-field"><label htmlFor="nebula-lens">Dataset</label><SiteDatasetSelect shell={shell} controller={controller} /></div>
          <label><input type="checkbox" checked={shell.originalOverlay?.enabled ?? false} disabled={!shell.originalOverlay?.available || shell.busy}
            onChange={event => run(controller.current?.showOriginal(event.currentTarget.checked))} /> Original image</label>
          {shell.presentation?.status.message && <p role={shell.presentation.status.error ? 'alert' : 'status'}>{shell.presentation.status.message}</p>}
        </StepSection></StepPanel>
      </div></section>
    </main>
  </>;
}
