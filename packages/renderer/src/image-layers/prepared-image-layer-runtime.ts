import { presentPhysicalPoseInVolume, worldRotationCss, worldRotationFromQuaternion } from '@cssearth/engine';
import { preparedVolumeCameraTransform, STACK_OPACITY_CEILING } from '../volume/prepared-volume-runtime.js';
import { createSettlePacer } from '../rendering/settle-pacer.js';
import type { VolumeCameraPublication } from '../volume/types.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from '@cssearth/objects';

/** A leaf as a rectangle in bank units: its centre, its unit edge directions, its half extents and its normal, from the
 * prepared corners. A sheet is left out of the drawing while the camera stands within one of its stack's sampling steps
 * of it (`publish`): a camera inside the bank, at a nebula's central star, would otherwise see the sheets through the
 * middle, which carry the star's own light, with texels larger than the view, and a sheet crossing the camera plane. */
interface Sheet { readonly c: readonly [number, number, number]; readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number];
  readonly n: readonly [number, number, number]; readonly hu: number; readonly hv: number }
function sheetOf(centre: readonly [number, number, number], corners: readonly (readonly [number, number, number])[]): Sheet | null {
  const [a, b, , d] = corners;
  if (!a || !b || !d) return null;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (!(lu > 0) || !(lv > 0)) return null;
  const eu = [u[0]! / lu, u[1]! / lu, u[2]! / lu] as const, ev = [v[0]! / lv, v[1]! / lv, v[2]! / lv] as const;
  const n = [eu[1] * ev[2] - eu[2] * ev[1], eu[2] * ev[0] - eu[0] * ev[2], eu[0] * ev[1] - eu[1] * ev[0]], ln = Math.hypot(...n);
  if (!(ln > 0)) return null;
  return { c: centre, u: eu, v: ev, n: [n[0]! / ln, n[1]! / ln, n[2]! / ln], hu: lu / 2, hv: lv / 2 };
}
/** Whether the camera at `p` (bank units) is nearer than `reach` to the sheet: the distance from a point to a rectangle. */
function withinReach(sheet: Sheet, p: readonly number[], reach: number): boolean {
  const dx = p[0]! - sheet.c[0], dy = p[1]! - sheet.c[1], dz = p[2]! - sheet.c[2];
  const along = dx * sheet.n[0] + dy * sheet.n[1] + dz * sheet.n[2];
  const across = Math.max(0, Math.abs(dx * sheet.u[0] + dy * sheet.u[1] + dz * sheet.u[2]) - sheet.hu);
  const down = Math.max(0, Math.abs(dx * sheet.v[0] + dy * sheet.v[1] + dz * sheet.v[2]) - sheet.hv);
  return along * along + across * across + down * down < reach * reach;
}

/** Transparent prepared layer banks. No opaque viewport matte is allowed here. */
/** How many runs of a stack join the layer tree in its first frame, and in each frame after (`join`). */
const JOIN_FIRST_RUNS = 1, JOIN_RUNS = 2;

export function mountPreparedCssImageLayers({ host, before, payload, resolveResource, onDrawn }: {
  host: HTMLElement; before: Element; payload: PreparedCssImageLayers; resolveResource(path: string): string;
  /** Told when a stack's images are decoded and it joins the drawing with the camera still: who hands the picture
   * over to this bank learns that it draws (universe-catalog-banks.ts). */
  onDrawn?(): void;
}) {
  const document = host.ownerDocument, root = document.createElement('div');
  root.className = 'prepared-image-layer-bank'; root.dataset.imageLayerObject = payload.id;
  // The bank fills the universe root; its projections are transparent and their scenes composite once (volume.css).
  // A stack without leaves draws nothing: it is not mounted and takes no part in the choice of view.
  const drawn = payload.stacks.filter(stack => stack.leaves.length > 0);
  const views = payload.bankViews.filter(view => drawn.some(stack => stack.axis === view.axis));
  // A stack coming into the drawing waits for its images: shown with them undecoded, every leaf decoded its WebP on the
  // page's thread inside one paint. On an iPad a turn onto another stack of NGC 2392's 57 leaves made a frame of 235 ms
  // (63 paints, 204 ms of them in VP8 decode under WebKit's drawNativeImage), the Southern Ring's 171 ms, and a dataset
  // coming back 203 to 270 ms (2026-10-05). The stack's images are decoded through handles it keeps while it draws, and it
  // turns visible when they are done; a document without Image.decode (a test's) shows it at once.
  // The stack then shows whole. Its leaves joining a share a frame instead was measured and rejected: every joining frame
  // painted the layers already on screen again (M31's turns 125 to 160 ms against 41 to 43 whole, NGC 2392's 122 against
  // 36), though it suited the Helix, whose stacks of 87 and 91 leaves with an image each cost 68 to 104 ms shown whole.
  const Decoder = (document.defaultView as { Image?: new () => { src: string; decode(): Promise<void> } } | null)?.Image;
  const decodes = typeof Decoder?.prototype?.decode === 'function';
  const banks = drawn.map(stack => {
    const projection = document.createElement('div');
    projection.className = 'css-volume-projection';
    projection.dataset.imageLayerAxis = stack.axis;
    projection.style.opacity = '0'; projection.style.visibility = 'hidden';
    // Same camera-driven scene as a volume: its will-change keeps slice raster scales through rotation. A stack is one
    // scene, or the runs of leaves its view names (sceneSizes): each run under a camera of its own in the stack's
    // projection, painted in the stack's order, so the browser sorts and cuts only one run's leaves against each other.
    const textures: { element: HTMLElement; own: string; path: string; sheet: Sheet | null; shown: string;
      /** Where the leaf stands along its stack's normal, its place in that order, and the paint order last written. */
      along: number; rank: number; over: string }[] = [];
    const runs: { camera: HTMLElement; scene: HTMLElement; mesh: HTMLElement; leaves: HTMLElement[] }[] = [];
    const view = views.find(view => view.axis === stack.axis);
    let next = 0;
    for (const size of view?.sceneSizes ?? [stack.leaves.length]) {
      const camera = document.createElement('div'), scene = document.createElement('div'), mesh = document.createElement('div'), leaves: HTMLElement[] = [];
      camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
      // A run is out of layout until its stack is drawn and it joins (`join`).
      camera.style.display = 'none';
      for (const leaf of stack.leaves.slice(next, next + size)) {
        const element = document.createElement('s');
        element.dataset.imageLayerLeaf = leaf.id;
        Object.assign(element.style, leaf.style);
        textures.push({ element, own: leaf.style.transform, path: leaf.texturePath,
          sheet: leaf.verticesUnits ? sheetOf(leaf.centerUnits, leaf.verticesUnits) : null, shown: '',
          along: view ? leaf.centerUnits[0] * view.normalUnits[0] + leaf.centerUnits[1] * view.normalUnits[1] + leaf.centerUnits[2] * view.normalUnits[2] : 0, rank: 0, over: '' });
        mesh.appendChild(element); leaves.push(element);
      }
      next += size;
      scene.appendChild(mesh); camera.appendChild(scene); projection.appendChild(camera);
      runs.push({ camera, scene, mesh, leaves });
    }
    [...textures].sort((a, b) => a.along - b.along).forEach((texture, rank) => { texture.rank = rank; });
    root.appendChild(projection);
    return { axis: stack.axis, projection, runs, textures, normal: view?.normalUnits ?? null, images: null as string[] | null, drawn: false, ready: !decodes, turn: 0, handles: [] as unknown[],
      /** How many of its runs have joined the layer tree: its first ones. */
      joined: 0,
      perspective: '', perspectiveOrigin: '', transform: '', reach: view?.samplingStepUnits ?? 0,
      patches: view?.sceneSizes !== undefined, apart: null as HTMLElement | null, spare: null as HTMLElement | null };
  });
  /** A stack leaves its scenes for one flat element (`apart`), or goes back. In a shared scene the browser sorts the
   * leaves by depth and cuts each along the planes of the others, and seen from inside it does not draw some of them:
   * turning inside the Homunculus, a wall patch 1,010 px wide went black for a step of the drag and came back, at the
   * same camera places on every pass, and drew whenever one other patch of its run was taken away; inside NGC 2392 the
   * sheet beside the camera came and went the same way. The same turns had 15 such jumps of the picture in the
   * Homunculus and 4 to 6 in NGC 2392 with shared scenes; apart, 1 (a patch the camera passes through) and none
   * (headless Chrome, 2026-10-05). Apart, the element is flat and carries the perspective, and every leaf under it
   * carries the camera's transform before its own: no leaf is sorted or cut against another. Patches paint in the
   * stack's order, as their runs already do; parallel sheets paint farthest first on each side of the camera (`order`).
   * A leaf's transform is then written each frame: a frame of a drag went from 4.5 to 5.0 ms of main-thread time with
   * the Homunculus's 1,025 patches and from 4.5 to 5.7 ms with Cassiopeia A's 1,397, so a stack is apart only while it
   * is drawn around a body. The element stays built when it is not used. */
  const arrange = (bank: (typeof banks)[number], apart: boolean) => {
    if ((bank.apart !== null) === apart) return;
    // What was written to the arrangement left behind says nothing of this one: every write is made again.
    bank.perspective = bank.perspectiveOrigin = bank.transform = '';
    if (apart) {
      const flat = bank.spare ?? document.createElement('div');
      flat.className = 'css-volume-mesh'; flat.style.transformStyle = 'flat'; flat.style.willChange = 'transform';
      for (const run of bank.runs) { for (const leaf of run.leaves) flat.appendChild(leaf); run.camera.remove(); }
      bank.projection.appendChild(flat); bank.apart = bank.spare = flat;
      return;
    }
    // Back in its runs, a stack that was drawn apart is whole at once: its leaves were on screen a frame ago.
    for (const run of bank.runs) { for (const leaf of run.leaves) run.mesh.appendChild(leaf); run.camera.style.display = bank.drawn ? '' : 'none'; bank.projection.appendChild(run.camera); }
    bank.joined = bank.drawn ? bank.runs.length : 0;
    for (const texture of bank.textures) { texture.element.style.transform = texture.own; if (texture.over !== '') { texture.over = ''; texture.element.style.zIndex = ''; } }
    bank.apart?.remove(); bank.apart = null;
  };
  /** Parallel sheets that are apart paint farthest first on each side of the camera: a sight line crosses the sheets of
   * one side only, so the two sides need no order between them, and a sheet's place changes only when the camera
   * passes its plane, where the sheet is left out. One write a passing, on that sheet. */
  const order = (bank: (typeof banks)[number], cameraUnits: readonly number[]) => {
    if (bank.patches || !bank.normal) return;
    const at = cameraUnits[0]! * bank.normal[0] + cameraUnits[1]! * bank.normal[1] + cameraUnits[2]! * bank.normal[2], last = bank.textures.length - 1;
    for (const texture of bank.textures) {
      const over = String(texture.along < at ? texture.rank : last - texture.rank);
      if (texture.over !== over) { texture.over = over; texture.element.style.zIndex = over; }
    }
  };
  host.insertBefore(root, before);
  let destroyed = false;
  const quotable = (address: string) => address.replace(/["\\\n\r]/g, char => `\\${char}`);
  const set = (element: HTMLElement, property: 'opacity' | 'visibility' | 'display', value: string) => {
    if (element.style[property] !== value) element.style[property] = value;
  };
  /** What is drawn stays until what replaces it can be. A stack the camera turns to is hidden while its images decode,
   * and its share of the picture was taken from the stacks drawn before it was shown: turning the Southern Ring on an
   * iPad, a recorded frame had the stack that drew at 0.14 and the one that did not at 0.86, and another had the only
   * stack wanted still hidden (2026-10-06). The stacks whose images are decoded share the whole picture; the one that
   * drew most (`lead`) stays, whole, when the camera has turned fully away from it before the next is decoded. */
  let lead: (typeof banks)[number] | null = null, mixed: Record<'x' | 'y' | 'z', number> | null = null;
  /** Whether every leaf of a decoded stack is in the layer tree: all its runs have joined, or it is drawn apart. */
  const whole = (bank: (typeof banks)[number]) => bank.apart !== null || bank.joined >= bank.runs.length;
  const draws = (bank: (typeof banks)[number]) => bank.drawn && bank.ready && whole(bank);
  const drawable = (weights: Record<'x' | 'y' | 'z', number>) => banks.filter(bank => weights[bank.axis] > 0 && draws(bank));
  /** A stack's runs leave layout with it, so that it joins them a few a frame when it is drawn again. */
  const leave = (bank: (typeof banks)[number]) => {
    if (bank.apart === null) for (let run = 0; run < bank.joined; run++) bank.runs[run]!.camera.style.display = 'none';
    bank.joined = 0;
  };
  /** A decoded stack joins the layer tree a few runs a frame, unseen, and takes its share of the picture when it is
   * whole. Shown whole in one frame, every leaf's layer and surface was made in that frame: Cassiopeia A's 1,397 patches
   * in 78 runs made a frame of 275 to 276 ms on an iPad with the camera still, and the Crab's bank one of 192 ms at a
   * dataset pick. Its runs joined at opacity 0, one in the first frame and two in each one after, made one frame of 45
   * to 48 ms, and the stack shown after them one of 18 to 39 ms; three a frame, 60 to 62 ms; four runs a frame in view
   * as they joined, 47 to 77 ms (2026-10-06). Safari makes the surfaces of layers that join under an opacity of 0 and
   * keeps them; what the stack replaces stays on screen meanwhile (`mix`). A stack of one run joins in one frame, as
   * before. */
  const join = createSettlePacer(() => {
    if (destroyed) return 0;
    for (const bank of banks) {
      if (!bank.drawn || !bank.ready || whole(bank)) continue;
      const share = bank.joined === 0 ? JOIN_FIRST_RUNS : JOIN_RUNS;
      let written = 0;
      while (written < share && bank.joined < bank.runs.length) { bank.runs[bank.joined++]!.camera.style.display = ''; written++; }
      if (whole(bank) && mixed) { mix(mixed); onDrawn?.(); }
      return written;
    }
    return 0;
  }, { holdWhile: 'never' });
  const heldOf = (weights: Record<'x' | 'y' | 'z', number>) => drawable(weights).length || !lead || !draws(lead) ? null : lead;
  const mix = (weights: Record<'x' | 'y' | 'z', number>) => {
    mixed = weights;
    const drawn = drawable(weights), share = drawn.reduce((sum, bank) => sum + weights[bank.axis], 0), held = heldOf(weights);
    if (drawn.length) lead = drawn.reduce((most, bank) => weights[bank.axis] > weights[most.axis] ? bank : most);
    for (const bank of banks) {
      const weight = weights[bank.axis], wanted = weight > 0 || bank === held;
      // Never 1 (STACK_OPACITY_CEILING): a drag across M31 had its longest frame at 108 to 111 ms with a bank's opacity
      // reaching 1, and 67 to 72 ms under the ceiling (iPad, 2026-10-04). A stack of patches was drawn at 1 for a day:
      // under the ceiling a wedge of the Homunculus had gone black for a step of a drag at its nearest view, in headless
      // Chrome. That was looked for again and not found. At the nearest view, on the nebula's page and around its star,
      // the picture under the ceiling matched the picture at 1 at every step: 580 steps in Chrome on a GPU, 90 in the
      // software-rendered shell, 11 on an iPad. And at 1 the bank crossed 1 on every zoom out: Cassiopeia A's 1,397
      // patches repainted in one frame of 291 ms on the iPad, 51 ms under the ceiling (2026-10-05).
      // A stack that is decoding or joining is unseen: at 0 its layers are made and kept (`join`).
      set(bank.projection, 'opacity', String(Math.min(STACK_OPACITY_CEILING, bank === held ? 1 : !draws(bank) ? 0 : share > 0 ? weight / share : weight)));
      set(bank.projection, 'visibility', wanted && bank.ready ? 'visible' : 'hidden');
      // A zero-weight axis contributes nothing; its 3D leaves leave compositing.
      set(bank.projection, 'display', wanted ? '' : 'none');
    }
  };
  return Object.freeze({ root,
    /** Whether any of the bank is on screen once its root is shown: a stack with its images decoded. */
    drawing: () => banks.some(draws),
    /** The bank root is shown again: each stack it draws waits for its images' decode, as one the camera turns to does. */
    resume() { lead = null; for (const bank of banks) { bank.drawn = false; bank.turn++; leave(bank); } },
    /** `around`: the bank is drawn around a body that stands inside it, at that place (reference metres). The sheets the
     * camera stands on are left out, and so are the sheets through the body: they hold the picture's own image of it, a
     * saturated glare many times its size, and the body is drawn in their place (Eta Carinae inside the Homunculus was a
     * white screen 1,200 AU out, 2026-10-05), and the leaves of each stack leave their shared scenes (`arrange`). As its
     * page's own subject a bank draws every sheet, as it always has. */
    publish(publication: VolumeCameraPublication, around: readonly [number, number, number] | false = false) {
      if (destroyed) return;
      const transform = preparedVolumeCameraTransform(publication, payload.frame);
      const cssTransform = `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
      const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
      const body = around ? presentPhysicalPoseInVolume({ positionM: around, orientationXyzw: publication.world.pose.orientationXyzw }, payload.frame).positionUnits : null;
      const weights = imageLayerAxisWeights(local.orientationXyzw, views);
      const [ox, oy] = publication.viewport.principalOffsetPixels;
      const perspective = `${transform.focalPixels}px`, perspectiveOrigin = `calc(50% + ${ox}px) calc(50% + ${oy}px)`;
      const held = heldOf(weights);
      for (const bank of banks) {
        // Every write is on change: this publishes every camera frame (motion-freezes-membership.md). A stack's scenes
        // take the same camera, so what was last written is kept once for the stack, not read back from each scene.
        arrange(bank, body !== null);
        if (bank.apart) {
          // The flat element is a point at the stage's centre: the perspective's origin is measured from there.
          const origin = `${ox}px ${oy}px`;
          if (bank.perspective !== perspective) { bank.perspective = perspective; bank.apart.style.perspective = perspective; }
          if (bank.perspectiveOrigin !== origin) { bank.perspectiveOrigin = origin; bank.apart.style.perspectiveOrigin = origin; }
          if (bank.transform !== cssTransform) { bank.transform = cssTransform; for (const texture of bank.textures) texture.element.style.transform = `${cssTransform} ${texture.own}`; }
          order(bank, local.positionUnits);
        } else {
          if (bank.perspective !== perspective) { bank.perspective = perspective; for (const { camera } of bank.runs) camera.style.perspective = perspective; }
          if (bank.perspectiveOrigin !== perspectiveOrigin) { bank.perspectiveOrigin = perspectiveOrigin; for (const { camera } of bank.runs) camera.style.perspectiveOrigin = perspectiveOrigin; }
          if (bank.transform !== cssTransform) { bank.transform = cssTransform; for (const { scene } of bank.runs) scene.style.transform = cssTransform; }
        }
        const weight = weights[bank.axis], wanted = weight > 0 || bank === held;
        if (wanted && !bank.images) {
          // Leaves cut from one atlas share its address.
          const images = new Map<string, string>(), addresses = new Map<string, string>();
          for (const { element, path } of bank.textures) {
            let image = images.get(path);
            if (image === undefined) { const address = resolveResource(path); addresses.set(path, address); images.set(path, image = `url("${quotable(address)}")`); }
            element.style.backgroundImage = image;
          }
          bank.images = [...addresses.values()];
        }
        if (wanted && !bank.drawn) {
          bank.drawn = true;
          if (Decoder && decodes) {
            const turn = ++bank.turn;
            bank.ready = false;
            bank.handles = bank.images!.map(address => { const handle = new Decoder(); handle.src = address; return handle; });
            // A failed decode still shows the stack: it then decodes as it paints, as before.
            void Promise.all((bank.handles as { decode(): Promise<void> }[]).map(handle => handle.decode().catch(() => {}))).then(() => {
              if (destroyed || bank.turn !== turn) return;
              bank.ready = true;
              // Whole, it takes its share from the stacks drawn so far in the same write, and a stack held for it leaves.
              if (!bank.drawn || !mixed) return;
              mix(mixed);
              if (whole(bank)) onDrawn?.(); else join.request(true);
            });
          } else if (!whole(bank)) join.request(true);
        } else if (!wanted && bank.drawn) { bank.drawn = false; bank.turn++; bank.handles = []; bank.ready = !decodes; leave(bank); }
        // Around a body, the sheets within one sampling step of the camera or of the body are left out (Sheet): an opacity
        // write on change only, and every sheet back when the bank is its page's subject again.
        if (weight > 0 && bank.reach > 0) for (const texture of bank.textures) {
          const shown = body && texture.sheet && (withinReach(texture.sheet, local.positionUnits, bank.reach) || withinReach(texture.sheet, body, bank.reach)) ? '0' : '';
          if (texture.shown !== shown) { texture.shown = shown; texture.element.style.opacity = shown; }
        }
      }
      mix(weights);
    },
    destroy() { if (destroyed) return; destroyed = true; join.destroy(); root.remove(); },
  });
}

/** Narrow continuous transitions keep near-edge-on faces out of the chosen projection. A view alone keeps the whole
 * weight, seen edge-on too. */
export function imageLayerAxisWeights(orientation: readonly [number, number, number, number], views: readonly PreparedImageLayerView[]) {
  const matrix = worldRotationFromQuaternion(orientation);
  const strengths = views.map(view => Math.abs(matrix[2] * view.normalUnits[0] + matrix[5] * view.normalUnits[1] +
    matrix[8] * view.normalUnits[2]) / view.samplingStepUnits);
  const maximum = Math.max(...strengths);
  const weights = strengths.map(value => {
    const t = Math.max(0, Math.min(1, ((maximum > 0 ? value / maximum : 1) - 1 + .16) / .16));
    return t * t * (3 - 2 * t);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(views.map((view, index) => [view.axis, weights[index] / total])) as Record<'x' | 'y' | 'z', number>;
}
