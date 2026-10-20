/**
 * The embedded page's side of the embed bridge (`/<object>/?embed&bridge=<host origin>`): the nebula lab shows the site's
 * own page in a frame and drives it through these typed messages (@cssearth/renderer/embed/embed-bridge.ts). Loaded
 * only for such a link (scene-router.mts); the website never loads it.
 *
 * The page publishes its state (object, dataset, the bank that dataset shows, hidden layers) and every camera its world
 * renders, as the renderer receives it. It obeys the host's commands through the site's own paths: a dataset is a link
 * navigation, a view a shared-view restore, Earth view and Fit the navigation's own targets, a turn the scene's own turn,
 * and layers the world's layer switches. The page stays on its object: the router refuses other objects in this mode.
 */
import { EMBED_BRIDGE_PROTOCOL, EMBED_HIDDEN_LAYERS_PARAMETER, embedBridgeOrigin, embedCamera, parseEmbedHostCommand, readHiddenWorldLayers,
  type EmbedCamera, type EmbedCommand, type EmbedPageMessage } from '@cssearth/renderer/embed/embed-bridge.ts';
import { worldLayerVisibility, type WorldLayer, type WorldLayerVisibility } from '@cssearth/renderer/universe/world-layers.ts';
import { formatSharedView, parseSharedView } from '@cssearth/renderer/navigation';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
import type { WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '@cssearth/renderer/navigation/camera/world-camera.ts';
import { isSceneClick } from '@cssearth/renderer/navigation/picking/world-camera-picking.ts';
import { withSceneDataset } from '../model/dataset-url.mts';

/** What the bridge needs from the scene router: its one object and the scene mounted for it. */
export interface EmbedScenePort {
  readonly objectId: string;
  /** Settles when the page's first scene has arrived (or failed): its view then is the page's opening view. */
  settled(): Promise<unknown>;
  /** The scene mounted for the page's object (sceneMounted is told when it mounts). */
  mount(): ObjectSceneLifecycle | null;
  /** The page's address, which a dataset link is written from. */
  href(): string;
  /** Go to a link of this page (a dataset): the router's own navigation. */
  navigate(url: string): Promise<boolean | undefined>;
  /** Turn to the body's own facing (its photograph's, toward Earth) at the present distance, or fit the volume its dataset
   * shows; false when the object has no such view. */
  focus(target: 'earth' | 'fit', signal: AbortSignal): Promise<boolean>;
}
/** The world's layer switches (application-world-context.mts). */
export interface EmbedWorld { setLayerVisibility?(visibility: WorldLayerVisibility): void }

export function connectEmbedBridge({ windowTarget, port }: { windowTarget: Window; port: EmbedScenePort }) {
  const url = new URL(windowTarget.location.href), host = embedBridgeOrigin(url), parent = windowTarget.parent;
  if (!host || parent === windowTarget) return null;
  let hidden: WorldLayer[] = [];
  try { hidden = readHiddenWorldLayers(url.searchParams.get(EMBED_HIDDEN_LAYERS_PARAMETER)); } catch (error) { console.error(error); }
  let world: EmbedWorld | null = null, ready = false, destroyed = false, opening: WorldCameraPose | null = null, moving = false;
  let pending: EmbedCamera | null = null, frame: number | null = null;
  const unbind: (() => void)[] = [], sceneUnbind: (() => void)[] = [];
  const post = (message: EmbedPageMessage) => { if (!destroyed) parent.postMessage(message, host); };
  const layers = () => worldLayerVisibility(hidden);
  function postState() {
    const datasets = port.mount()?.datasets, dataset = datasets?.current() ?? null, volume = dataset ? datasets?.volumeOf(dataset) : null;
    post({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'state', objectId: port.objectId, ready, dataset, datasets: datasets ? [...datasets.ids] : [],
      volume: volume ? { objectId: volume.objectId, datasetId: volume.datasetId } : null, hidden });
  }
  // One camera message per frame, the last the world rendered.
  function postCamera() {
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    frame = null;
    if (pending) post({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'camera', camera: pending, moving });
  }
  const cameraChanged = (next: WorldCameraPose, viewport: WorldCameraViewport) => {
    pending = embedCamera(next, viewport);
    frame ??= windowTarget.requestAnimationFrame(postCamera);
  };
  const motionChanged = (event: Event) => {
    const active = (event as CustomEvent<{ active?: unknown }>).detail?.active === true;
    if (active !== moving) { moving = active; if (pending) frame ??= windowTarget.requestAnimationFrame(postCamera); }
  };
  windowTarget.document.addEventListener('objectmotionchange', motionChanged, { capture: true });
  // A click is a press and release within a few pixels: the host's pick tools (Annotate) read it; a drag orbits as ever.
  let pressed: { x: number; y: number; id: number } | null = null;
  const press = (event: PointerEvent) => { pressed = event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null; };
  const release = (event: PointerEvent) => {
    const start = pressed; pressed = null;
    if (start && start.id === event.pointerId && isSceneClick(event.clientX - start.x, event.clientY - start.y))
      post({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'click', x: event.clientX, y: event.clientY, shiftKey: event.shiftKey });
  };
  windowTarget.document.addEventListener('pointerdown', press, { capture: true, passive: true });
  windowTarget.document.addEventListener('pointerup', release, { capture: true, passive: true });
  unbind.push(() => { windowTarget.document.removeEventListener('pointerdown', press, { capture: true }); windowTarget.document.removeEventListener('pointerup', release, { capture: true }); });
  unbind.push(() => windowTarget.document.removeEventListener('objectmotionchange', motionChanged, { capture: true }));

  async function run(command: EmbedCommand, signal: AbortSignal): Promise<{ view?: string }> {
    const mount = port.mount();
    // A sync posts the camera now, before its reply: the host reads the camera of that moment from the messages in order.
    if (command.type === 'sync') {
      postState();
      const navigation = ready ? mount?.navigation : undefined;
      if (navigation) { pending = embedCamera(navigation.capture(), navigation.optics()); postCamera(); }
      return {};
    }
    if (command.type === 'set-layers') { hidden = [...command.hidden]; world?.setLayerVisibility?.(layers()); postState(); return {}; }
    if (!ready || !mount) throw new Error('The scene is still arriving.');
    const navigation = mount.navigation;
    switch (command.type) {
      case 'select-dataset': {
        const datasets = mount.datasets;
        if (!datasets?.ids.includes(command.id)) throw new RangeError(`Dataset “${command.id}” is not one of this page's.`);
        const target = withSceneDataset(new URL(port.href()), port.objectId, command.id === datasets.defaultId ? null : command.id);
        if (await port.navigate(target.href) === false) throw new Error(`Dataset “${command.id}” was not shown.`);
        return {};
      }
      case 'reset':
        if (!navigation || !opening) throw new Error('The page has no opening view.');
        await navigation.apply(opening, { signal });
        return {};
      // Without a prepared facing or a volume to fit, the page's opening view stands for it.
      case 'earth-view': case 'fit':
        if (!await port.focus(command.type === 'fit' ? 'fit' : 'earth', signal)) {
          if (!navigation || !opening) throw new Error('The page has no opening view.');
          await navigation.apply(opening, { signal });
        }
        return {};
      case 'turn': {
        if (!navigation?.turn) throw new Error('This scene does not turn.');
        await navigation.turn(command.degrees, { durationMilliseconds: 600, signal });
        return {};
      }
      case 'capture-view': {
        const view = mount.sharedView.capture(false);
        if (!view) throw new Error('The view cannot be captured yet.');
        return { view: new URLSearchParams(formatSharedView(view)).get('v')! };
      }
      case 'restore-view': {
        const view = parseSharedView(`v=${command.view}`);
        if (!view || !await mount.sharedView.restore(view)) throw new Error('The view was not restored.');
        return {};
      }
      default: throw new TypeError('Unknown embed command.');
    }
  }
  const commands = new AbortController();
  const message = (event: MessageEvent) => {
    if (event.origin !== host || event.source !== parent) return;
    const command = parseEmbedHostCommand(event.data);
    if (!command) return;
    const { protocol: _protocol, requestId, ...body } = command;
    void run(body as EmbedCommand, commands.signal).then(
      result => post({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'reply', requestId, ok: true, ...result }),
      (error: unknown) => post({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'reply', requestId, ok: false, error: error instanceof Error ? error.message : String(error) }));
  };
  windowTarget.addEventListener('message', message);
  unbind.push(() => windowTarget.removeEventListener('message', message));

  postState();
  let bound: ObjectSceneLifecycle | null = null;
  /** The scene mounted: the bridge is ready, and publishes its camera and datasets from now on. */
  function bindScene(mount: ObjectSceneLifecycle) {
    if (destroyed || bound === mount) return;
    for (const step of sceneUnbind.splice(0)) step();
    bound = mount; ready = true;
    const navigation = mount.navigation;
    if (navigation) {
      opening = navigation.capture();
      sceneUnbind.push(navigation.subscribe(cameraChanged));
      cameraChanged(opening, navigation.optics());
    }
    if (mount.datasets) {
      sceneUnbind.push(mount.datasets.subscribe(() => postState()));
      // A dataset is drawn once its bank has loaded: its state follows that, with the bank it shows.
      sceneUnbind.push(mount.datasets.subscribeLoading(loading => { if (!loading) postState(); }));
    }
    postState();
  }
  // Once the first arrival settles (its dataset framed), its view is the opening view Reset returns to.
  const arrivalSettled = () => {
    const mount = port.mount();
    if (destroyed || !mount) return;
    bindScene(mount);
    if (mount.navigation) opening = mount.navigation.capture();
  };
  void port.settled().then(arrivalSettled, arrivalSettled);
  return {
    sceneMounted: bindScene,
    /** The world mounted (or mounted again): it takes the host's layers before its first frame. */
    worldMounted(next: EmbedWorld) {
      world = next;
      if (hidden.length) next.setLayerVisibility?.(layers());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; commands.abort();
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      for (const step of [...sceneUnbind.splice(0), ...unbind.splice(0)]) step();
    },
  };
}
