import { interiorFillInset, withPreparedInteriorFill, withoutPreparedInteriorFill, type SurfaceMeanExclusion } from './prepared-interior-fill.mts';
import { MISSING_COVERAGE_STYLES, isMissingCoverageStyle } from '../../src/platform/prepare-missing-coverage.mts';
import { isRecord } from '@cssearth/core';
import type { PreparedInteriorDisc } from '../../src/renderers/css/rendering/prepared-interior-disc.ts';
import type { PreparedPresentationDefinition, PreparedVariant } from '../../src/renderers/css/rendering/prepared-presentation.ts';
import type { PresentationSource, DepthSurface } from './prepared-depth-partitions.mts';
/** A leaf's fixed plane in scene space, which the depth preparation needs to prove a surface static. */
type FacingBinding = { plane: [number, number, number, number]; tolerance: number };
type MotionTrack = Omit<NonNullable<PreparedPresentationDefinition['motion']>[number], 'timings'> & {timings: {when: PreparedVariant['when']; duration: number}[]};
interface DepthResult {id: string; source: PresentationSource; compiled: PresentationSource; surface: DepthSurface | null; reason: string | null | undefined;}

import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { objectPageStyles } from '../../site/object-page-contract.mts';
import { chromium, type Browser } from 'playwright';
import { prepareActivationGroups } from './prepared-activation-groups.mts';
import { prepareDepthPartitions, restoreDepthSource } from './prepared-depth-partitions.mts';
import { verifyDepthStyles } from './prepared-depth-styles.mts';
import { LEAF_BOX_FACTOR, withLeafBoxes } from './leaf-box.mts';

/** Resolve authored motion offline. Runtime receives explicit animation
 * handles, never a live style discovery pass; the browser culls back faces. */
export async function preparePresentationBindings<T extends PresentationSource>(input: T, root: string, { onDepthResult, interiorOnly = false, browser: suppliedBrowser, publicDirectory }: {onDepthResult?: (result: DepthResult) => void; interiorOnly?: boolean; browser?: Browser; publicDirectory?: string} = {}) {
  // A staged scene directory holds this object's assets flat; published assets live under public/scenes/<id>/.
  const assetRoot = publicDirectory ? (url: string) => {
    if (!url.startsWith(`/scenes/${input.id}/`)) throw new Error(`Interior fill asset ${url} is not this object's scene asset.`);
    return resolve(publicDirectory, basename(url));
  } : resolve(root, 'public');
  // A body that declares how it fills a data gap keeps that convention out of its interior colour: the disc stands in
  // for the surface behind the leaves, and a map that is mostly gap would otherwise give it a colour nobody sees.
  const declaredFill: unknown = await readFile(resolve(root, 'src/objects', input.id, 'source/preparation/raster.json'), 'utf8')
    .then(text => (JSON.parse(text) as { missingCoverage?: unknown }).missingCoverage, () => undefined);
  const gapExclusion: SurfaceMeanExclusion | undefined = isMissingCoverageStyle(declaredFill)
    ? { colors: [MISSING_COVERAGE_STYLES[declaredFill].base, MISSING_COVERAGE_STYLES[declaredFill].line], tolerance: 20 }
    : undefined;
  const definition = restoreDepthSource(withoutPreparedInteriorFill(input));
  const descriptor: unknown = JSON.parse(await readFile(resolve(root, 'src/objects', definition.id, 'object.json'), 'utf8'));
  const recipe = isRecord(descriptor) && isRecord(descriptor.properties) && isRecord(descriptor.properties.recipe) ? descriptor.properties.recipe : null;
  const shape = recipe && isRecord(recipe.shape) ? recipe.shape : null;
  const ellipsoid = shape?.kind === 'sphere' || shape?.kind === 'ellipsoid';
  const closed = ellipsoid && !definition.surfaceHit;
  const ratios = shape?.kind === 'ellipsoid' && typeof shape.radiusKm === 'number'
    ? [1, typeof shape.secondaryRadiusKm === 'number' ? shape.secondaryRadiusKm / shape.radiusKm : 1,
      typeof shape.polarRadiusKm === 'number' ? shape.polarRadiusKm / shape.radiusKm : 1] : [1, 1, 1];
  const styles = await Promise.all(objectPageStyles(descriptor).map(path => readFile(resolve(root, path), 'utf8')));
  const browser = suppliedBrowser ?? await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    // Prepared textures have no role in resolving authored motion. No asset
    // fetch is allowed during this CSS-only compilation step.
    await page.route('**/*', route => route.abort());
    await page.setContent('<main class="object-stage"></main>');
    await page.addStyleTag({ content: styles.join('\n') });
    const browserDefinition: PresentationSource = { ...definition, id: input.id };
    const prepared = await page.evaluate(({ definition, closed, ratios, inset, interiorOnly, leafBoxFactor }) => {
      const stage = document.querySelector('main');
      if (!stage) throw new TypeError('Preparation stage is missing.');
      stage.dataset.objectId = definition.id;
      stage.classList.add(...definition.tree.stageClasses);
      const nodes = definition.tree.nodes.map(record => {
        const node = document.createElement(record.tag);
        if (record.className) node.className = record.className;
        node.style.cssText = record.style;
        for (const id of record.properties) {
          const p = definition.tree.properties[id];
          if (p.custom) node.style.setProperty(p.name, p.value); else Reflect.set(node.style, p.name, p.value);
        }
        for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
        return node;
      });
      nodes.forEach((node, i) => (definition.tree.nodes[i].parent < 0 ? stage : nodes[definition.tree.nodes[i].parent]).append(node));
      const index = new Map<Element, number>(nodes.map((node, i) => [node, i]));
      const tracks = new Map<string, MotionTrack>();
      const dynamic = new Set([
        ...definition.animations.map(plan => plan.target),
        ...definition.viewBindings.filter(binding => !['view-attribute', 'view-property', 'silhouette-step-property'].includes(binding.kind)).map(binding => binding.target),
        ...definition.materials.map(track => track.target),
        // These properties have another publisher: a leaf under selection visibility or an
        // authored changing transform has no fixed plane for the depth preparation.
        ...definition.variants.flatMap(variant => variant.writes.filter(write => write.kind === 'style' &&
          ['visibility', 'display', 'transform', 'transformOrigin', 'transform-origin'].includes(write.name)).map(write => write.target)),
      ]);
      function determinant(matrix: DOMMatrix) {
        const values = [0, 1, 2, 3].map(row => [0, 1, 2, 3].map(col => matrix.toFloat64Array()[col * 4 + row]));
        let result = 1;
        for (let col = 0; col < 4; col++) {
          let pivot = col;
          for (let row = col + 1; row < 4; row++) if (Math.abs(values[row][col]) > Math.abs(values[pivot][col])) pivot = row;
          if (values[pivot][col] === 0) return 0;
          if (pivot !== col) { [values[col], values[pivot]] = [values[pivot], values[col]]; result = -result; }
          const diagonal = values[col][col]; result *= diagonal;
          for (let row = col + 1; row < 4; row++) {
            const factor = values[row][col] / diagonal;
            for (let column = col + 1; column < 4; column++) values[row][column] -= factor * values[col][column];
          }
        }
        return result;
      }
      function facingPlane(target: number): FacingBinding | null {
        const leaf = nodes[target];
        if (leaf.children.length || getComputedStyle(leaf).backfaceVisibility !== 'hidden') return null;
        let matrix = new DOMMatrix(), cursor = target;
        while (cursor !== definition.tree.scene && cursor >= 0) {
          if (dynamic.has(cursor)) return null;
          const style = getComputedStyle(nodes[cursor]);
          // Nonzero layout offsets, individual transforms and nested perspective
          // need their own prepared projection contract. Never guess a plane.
          if (![style.left, style.top].every(v => v === 'auto' || parseFloat(v) === 0) ||
              style.translate !== 'none' || style.rotate !== 'none' || style.scale !== 'none' || style.perspective !== 'none') return null;
          const origin = style.transformOrigin.split(' ').map(parseFloat);
          const transform = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
          matrix = new DOMMatrix().translate(origin[0], origin[1], origin[2] ?? 0)
            .multiply(transform).translate(-origin[0], -origin[1], -(origin[2] ?? 0)).multiply(matrix);
          cursor = definition.tree.nodes[cursor].parent;
        }
        if (cursor < 0) return null;
        const inverse = matrix.inverse();
        const plane = [inverse.m13, inverse.m23, inverse.m33, inverse.m43];
        const length = Math.hypot(...plane.slice(0, 3));
        // Chromium tests cofactor33 * determinant against float epsilon.
        // Preserve its scale-dependent tolerance when normalizing the plane.
        const det = determinant(matrix);
        const tolerance = 2 ** -23 / (length * det * det);
        return length > 0 && plane.every(Number.isFinite) && Number.isFinite(tolerance)
          ? { plane: [plane[0] / length, plane[1] / length, plane[2] / length, plane[3] / length], tolerance } : null;
      }
      let depthReason: string | null | undefined;
      const rejectDepth = (reason: string): null => { depthReason = reason; return null; };
      function depthSurface(): DepthSurface | null {
        depthReason = null;
        const source = definition.surfaceHit;
        if (!source) return rejectDepth('no triangle surface contract');
        if (definition.motionFrame?.length) return rejectDepth('moving surface');
        const body = nodes[source.target], leaves = [...body.children].map(node => {
          const id = index.get(node); if (id === undefined) throw new TypeError('Surface contains an unprepared child.'); return id;
        });
        if (leaves.length <= 64 || leaves.length !== source.triangles.length) return rejectDepth('leaf count or topology');
        const chain = new Set<number>();
        let matrix = new DOMMatrix();
        for (let cursor = source.target; cursor !== definition.tree.scene;) {
          if (cursor < 0 || dynamic.has(cursor)) return rejectDepth('dynamic ancestry');
          chain.add(cursor);
          const style = getComputedStyle(nodes[cursor]);
          if (style.opacity !== '1' || style.perspective !== 'none' || style.translate !== 'none' || style.rotate !== 'none' || style.scale !== 'none') return rejectDepth('unsupported ancestor projection');
          const origin = style.transformOrigin.split(' ').map(parseFloat);
          matrix = new DOMMatrix().translate(origin[0], origin[1], origin[2] ?? 0)
            .multiply(new DOMMatrix(style.transform === 'none' ? undefined : style.transform))
            .translate(-origin[0], -origin[1], -(origin[2] ?? 0)).multiply(matrix);
          cursor = definition.tree.nodes[cursor].parent;
        }
        const affected = new Set([definition.tree.scene, ...chain, ...leaves]);
        // Frame-owned attributes/properties can alter cloned ancestor selectors
        // or material variables. Only the common stage/camera publishers may
        // affect these static groups; unsupported local owners keep native depth.
        if (definition.viewBindings.some(binding => affected.has(binding.target))) return rejectDepth('frame-owned local binding');
        // A static surface must be one independent presentation. Siblings,
        // animated shells and layered geometry keep their original depth space.
        for (const node of nodes[definition.tree.scene].querySelectorAll('*')) {
          const id = index.get(node);
          if (id === undefined || !chain.has(id) && !leaves.includes(id)) return rejectDepth('other scene descendants');
          for (const pseudo of ['::before', '::after']) if (!['none', 'normal'].includes(getComputedStyle(node, pseudo).content)) return rejectDepth('generated scene content');
        }
        const frontSigns = [];
        for (const [face, target] of leaves.entries()) {
          if (!facingPlane(target)) return rejectDepth('unresolved static facing');
          const style = getComputedStyle(nodes[target]);
          if (!style.transformOrigin.split(' ').every(value => parseFloat(value) === 0)) return rejectDepth('offset leaf origin');
          if (style.getPropertyValue('corner-top-left-shape') !== 'bevel' || style.getPropertyValue('corner-top-right-shape') !== 'bevel' ||
              style.borderTopLeftRadius !== '50% 100%' || style.borderTopRightRadius !== '50% 100%') return rejectDepth('non-triangle leaf');
          const width = parseFloat(style.width), height = parseFloat(style.height);
          const inverse = new DOMMatrix(style.transform).inverse();
          const [a, b, c] = source.triangles[face];
          const u = b.map((v, axis) => v - a[axis]), v = c.map((value, axis) => value - a[axis]);
          const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const facing = [inverse.m13, inverse.m23, inverse.m33];
          const alignment = normal.reduce((sum, value, axis) => sum + value * facing[axis], 0) / (Math.hypot(...normal) * Math.hypot(...facing));
          if (!Number.isFinite(alignment) || Math.abs(alignment) < 0.999999) return rejectDepth('source and rendered facing differ');
          frontSigns.push(alignment > 0 ? 1 : -1);
          // Prove that source face i is carried by leaf i, rather than assuming
          // that a hit-test mesh happens to share the renderer's ordering.
          for (const vertex of source.triangles[face]) {
            const p = inverse.transformPoint(new DOMPoint(...vertex));
            const u = p.x / width, v = p.y / height;
            // CSSOM matrix serialization rounds to six significant digits.
            // Bound the plane check relative to the source coordinate scale;
            // the in-triangle check remains in normalized texture coordinates.
            const planeTolerance = 1e-5 * Math.max(1, ...vertex.map(Math.abs));
            if (![u, v, p.z].every(Number.isFinite) || Math.abs(p.z) > planeTolerance ||
                v < -1e-4 || v > 1.0001 || Math.abs(u - 0.5) > v * 0.5 + 1e-4) return rejectDepth('source face is outside its rendered leaf');
          }
        }
        return { target: source.target, leaves, frontSigns, bodyFromScene: Array.from(matrix.inverse().toFloat64Array()) };
      }
      function frame(target: number): DOMMatrix | null {
        let result = new DOMMatrix();
        for (let cursor = target; cursor !== definition.tree.scene; cursor = definition.tree.nodes[cursor].parent) {
          if (cursor < 0) return null;
          const style = getComputedStyle(nodes[cursor]);
          if (![style.left, style.top].every(value => value === 'auto' || parseFloat(value) === 0) ||
              style.translate !== 'none' || style.rotate !== 'none' || style.scale !== 'none' || style.perspective !== 'none') return null;
          const origin = style.transformOrigin.split(' ').map(parseFloat);
          result = new DOMMatrix().translate(origin[0], origin[1], origin[2] ?? 0)
            .multiply(new DOMMatrix(style.transform === 'none' ? undefined : style.transform))
            .translate(-origin[0], -origin[1], -(origin[2] ?? 0)).multiply(result);
        }
        return result;
      }
      function interiorGeometry(): PreparedInteriorDisc | null {
        if (!closed || ratios.some(value => !(value > 0) || !Number.isFinite(value))) return null;
        const bodies = definition.tree.nodes.flatMap((node, id) =>
          node.className?.split(/\s+/u).some(name => name.endsWith('-body')) && !node.className.includes('cutaway') ? [id] : []);
        if (!bodies.length) return null;
        const sceneFromBody = frame(bodies[0]);
        if (!sceneFromBody || !sceneFromBody.toFloat64Array().every(Number.isFinite)) return null;
        const unitFromScene = new DOMMatrix().scale(1/ratios[0], 1/ratios[1], 1/ratios[2]).multiply(sceneFromBody.inverse());
        let support = Infinity, count = 0;
        for (const body of bodies) for (const leaf of nodes[body].querySelectorAll('*')) {
          if (leaf.children.length) continue;
          const target = index.get(leaf);
          if (target === undefined) return null;
          const sceneFromLeaf = frame(target);
          if (!sceneFromLeaf) return null;
          // z=0 in the leaf's frame. Inverse row 3 transports that plane to
          // the normalized body frame, including projective leaf transforms.
          const inverse = unitFromScene.multiply(sceneFromLeaf).inverse();
          const distance = Math.abs(inverse.m43) / Math.hypot(inverse.m13, inverse.m23, inverse.m33);
          if (!(distance > 0) || !Number.isFinite(distance)) return null;
          support = Math.min(support, distance); count++;
        }
        if (count < 4) return null;
        return { sceneFromBody: Array.from(sceneFromBody.toFloat64Array()),
          radii: [ratios[0]*support, ratios[1]*support, ratios[2]*support], inset };
      }
      // Spherical/ellipsoidal bodies declare their axis ratios. Their axial
      // spin preserves these bounds; irregular surface meshes are excluded.
      /** Where the faces behind each level-managed texture write sit at rest, in scene coordinates
       * (`PreparedTexturePlacements`). Spherical and ellipsoidal bodies only: the runtime tests facing against one sphere. */
      function texturePlacements() {
        const managed = definition.textureLevels?.levels[0]?.resources;
        // The exterior body meshes (the surface and its polar caps). The cutaway's outer shell repeats their faces in
        // place; its section faces cross the centre and say nothing about where a page sits.
        const bodies = new Set(definition.tree.nodes.flatMap((node, id) =>
          node.className?.split(/\s+/u).some(name => name.endsWith('-body')) && !node.className.includes('cutaway') ? [id] : []));
        if (!managed || !closed || !bodies.size) return null;
        const sceneFromBody = frame([...bodies][0]!);
        if (!sceneFromBody) return null;
        const exterior = (target: number) => { for (let cursor = definition.tree.nodes[target].parent; cursor >= 0; cursor = definition.tree.nodes[cursor].parent) if (bodies.has(cursor)) return true; return false; };
        const origin = sceneFromBody.transformPoint(new DOMPoint(0, 0, 0)), centre = [origin.x, origin.y, origin.z];
        const names = new Set(definition.variants.flatMap(variant => variant.writes.flatMap(write =>
          write.kind === 'texture' && write.resource !== null && write.resource in managed ? [write.name] : [])));
        const corners = new Map<string, number[][]>();
        for (const [target, record] of definition.tree.nodes.entries()) {
          const used = [...names].filter(name => record.style.includes(`var(${name})`));
          if (!used.length || !exterior(target)) continue;
          const sceneFromLeaf = frame(target), style = getComputedStyle(nodes[target]);
          const width = parseFloat(style.width), height = parseFloat(style.height);
          if (!sceneFromLeaf || !(width > 0) || !(height > 0)) return null;
          const points = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => {
            const point = sceneFromLeaf.transformPoint(new DOMPoint(x, y, 0, 1));
            return [point.x / point.w, point.y / point.w, point.z / point.w];
          });
          if (!points.flat().every(Number.isFinite)) return null;
          for (const name of used) corners.set(name, [...corners.get(name) ?? [], ...points]);
        }
        if (!corners.size) return null;
        const length = (vector: number[]) => Math.hypot(...vector), minus = (a: number[], b: number[]) => a.map((value, axis) => value - b[axis]!);
        // Rounded outward: a larger bound and spread, and a smaller body, only ever count more faces as seen.
        const up = (value: number, step: number) => Math.ceil(value / step) * step, fixed = (value: number) => Number(value.toFixed(2));
        let radius = Infinity;
        const writes: Record<string, { center: number[]; radius: number; normal: number[]; spread: number }> = {};
        for (const [name, points] of corners) {
          const center = [0, 1, 2].map(axis => points.reduce((sum, point) => sum + point[axis]!, 0) / points.length);
          const out = minus(center, centre), normal = out.map(value => value / length(out));
          let bound = 0, spread = 0;
          for (const point of points) {
            bound = Math.max(bound, length(minus(point, center)));
            const direction = minus(point, centre);
            radius = Math.min(radius, length(direction));
            spread = Math.max(spread, Math.acos(Math.max(-1, Math.min(1, direction.reduce((sum, value, axis) => sum + value * normal[axis]!, 0) / length(direction)))));
          }
          writes[name] = { center: center.map(fixed), radius: fixed(up(bound, 0.01)), normal: normal.map(value => Number(value.toFixed(4))), spread: Number(up(spread, 1e-4).toFixed(4)) };
        }
        return { body: { center: centre.map(fixed), radius: Math.floor(radius * 100) / 100 }, writes };
      }
      /** Every leaf whose box follows the body on screen (tools/prepared/leaf-box.mts), measured at its full box (no factor
       * is written yet), and the body's centre, in scene coordinates. A leaf under the exterior body mesh is surface. A leaf
       * the default presentation does not render (Sgr A*'s sphere under display: none) backs no layer and has no measurable
       * frame: it is left out, and keeps its full box through the factor's fallback. */
      function leafBoxMeasurements() {
        const bodies = new Set(definition.tree.nodes.flatMap((node, id) =>
          node.className?.split(/\s+/u).some(name => name.endsWith('-body')) && !node.className.includes('cutaway') ? [id] : []));
        const sceneFromBody = bodies.size ? frame([...bodies][0]!) : null;
        if (!sceneFromBody) return null;
        const exterior = (target: number) => { for (let cursor = definition.tree.nodes[target].parent; cursor >= 0; cursor = definition.tree.nodes[cursor].parent) if (bodies.has(cursor)) return true; return false; };
        const origin = sceneFromBody.transformPoint(new DOMPoint(0, 0, 0));
        const leaves = [];
        for (const target of definition.tree.nodes.keys()) {
          if (!nodes[target]?.style.transform.includes(`var(${leafBoxFactor}`)) continue;
          if (!nodes[target].checkVisibility()) continue;
          // A runtime bound by an earlier bake carries each leaf's factor; measure the full box it scales, as the first bake
          // did, so every bake measures the same leaf.
          nodes[target].style.setProperty(leafBoxFactor, '1');
          const sceneFromLeaf = frame(target), style = getComputedStyle(nodes[target]);
          const width = parseFloat(style.width), height = parseFloat(style.height);
          if (!sceneFromLeaf || !(width > 0) || !(height > 0)) return null;
          leaves.push({ node: target, frame: Array.from(sceneFromLeaf.toFloat64Array()), width, height, surface: exterior(target) });
        }
        return leaves.length ? { leaves, bodyCentre: [origin.x, origin.y, origin.z] } : null;
      }
      for (const animation of stage.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 0; }
      const placements = texturePlacements();
      const leafBoxes = interiorOnly ? null : leafBoxMeasurements();
      const interior = interiorGeometry();
      const bodyNode = definition.tree.nodes.findIndex(node => node.className?.split(/\s+/u).some(name => name.endsWith('-body')) && !node.className.includes('cutaway'));
      if (interiorOnly) return { interior, placements, leafBoxes, surface: null, depthReason: null, motion: [] };
      // Preserve the default CSS animation order for existing saved playback
      // times. Hidden variants may expose additional prepared motion handles.
      const selections = [null, ...definition.variants];
      let motionIdentities: string[] | undefined, surface: DepthSurface | null | undefined, variableSurface = false;
      for (const variant of selections) {
        if (variant) for (const binding of variant.writes) {
          const node = binding.target < 0 ? stage : nodes[binding.target];
          if (binding.kind === 'attribute') {
            if (binding.value === null) node.removeAttribute(binding.name); else node.setAttribute(binding.name, binding.value);
          } else if (binding.kind === 'class') node.classList.toggle(binding.name, binding.value);
          else if (binding.kind === 'style') {
            if (binding.name.startsWith('--')) node.style.setProperty(binding.name, binding.value);
            else Reflect.set(node.style, binding.name, binding.value);
          }
        }
        const identities: string[] = [];
        for (const animation of stage.getAnimations({ subtree: true })) {
          if (!(animation instanceof CSSAnimation)) throw new TypeError('Only authored CSS motion enters the motion compiler.');
          if (!(animation.effect instanceof KeyframeEffect) || !animation.effect.target) throw new TypeError('Authored motion must target a prepared node.');
          const target = index.get(animation.effect.target);
          if (target === undefined) throw new TypeError('Authored motion must target a prepared node.');
          dynamic.add(target);
          const timing = animation.effect.getTiming();
          const frames = animation.effect.getKeyframes().map(frame => {
            if (Object.keys(frame).some(key => !['offset', 'computedOffset', 'easing', 'composite', 'transform'].includes(key)) ||
                typeof frame.transform !== 'string' || frame.easing !== 'linear' || !['auto', 'replace'].includes(frame.composite)) {
              throw new TypeError('Authored motion must supply final linear transform keyframes.');
            }
            return { offset: frame.computedOffset, transform: frame.transform };
          });
          if (typeof timing.duration !== 'number' || !(timing.duration > 0) || timing.delay !== 0 || timing.endDelay !== 0 || timing.easing !== 'linear' ||
              timing.direction !== 'normal' || timing.iterations !== Infinity) throw new TypeError('Unsupported authored motion timing.');
          const track: MotionTrack = { target, id: animation.animationName, keyframes: frames, duration: timing.duration, timings: [] };
          const identity = `${target}:${animation.animationName}`;
          if (identities.includes(identity)) throw new TypeError('Authored motion identities must be unique per node.');
          identities.push(identity);
          const previous = tracks.get(identity);
          if (previous) {
            if (JSON.stringify(previous.keyframes) !== JSON.stringify(track.keyframes)) throw new TypeError('Selection-dependent motion keyframes require explicit preparation.');
            if (variant && timing.duration !== previous.duration) previous.timings.push({ when: variant.when, duration: timing.duration });
          } else tracks.set(identity, track);
        }
        motionIdentities ??= [...identities].sort();
        if (JSON.stringify(motionIdentities) !== JSON.stringify([...identities].sort())) {
          throw new TypeError('Selection-dependent motion membership requires explicit preparation.');
        }
        const nextSurface = depthSurface();
        if (surface !== undefined && JSON.stringify(surface) !== JSON.stringify(nextSurface)) variableSurface = true;
        surface = nextSurface;
      }
      // Recheck after every variant has declared its motion targets.
      const finalSurface = variableSurface ? null : depthSurface();
      return { interior, placements, leafBoxes, surface: finalSurface, depthReason: variableSurface ? 'selection-dependent geometry' : depthReason, motion: [...tracks.values()] };
    }, { definition: browserDefinition, closed, ratios, inset: interiorFillInset, interiorOnly, leafBoxFactor: LEAF_BOX_FACTOR });
    const { interior, placements, leafBoxes, surface, depthReason, ...bindings } = prepared;
    const placed = <D extends { textureLevels?: unknown }>(value: D): D => placements && isRecord(value.textureLevels)
      ? { ...value, textureLevels: { ...value.textureLevels, placements } } : value;
    if (interiorOnly) return withPreparedInteriorFill(placed(withoutPreparedInteriorFill(input)), interior, assetRoot, gapExclusion);
    const bound = placed({ ...definition, ...bindings, tree: { ...definition.tree, activationGroups: prepareActivationGroups(definition) } });
    // Leaf boxes: each leaf's factor, the body's steps and their binding (leaf-box.mts).
    // The steps start at the body's logical diameter, which only an object runtime's camera carries.
    const logicalBodyDiameter: unknown = isRecord(definition.camera) ? definition.camera.logicalBodyDiameter : undefined;
    if (leafBoxes && !(typeof logicalBodyDiameter === 'number' && logicalBodyDiameter > 0)) {
      throw new TypeError(`${definition.id}: leaf boxes need the camera's logical body diameter, not ${String(logicalBodyDiameter)}.`);
    }
    // Always rewritten: a body with no rendered leaf (Sgr A*) still drops what an earlier bake wrote.
    const source = withLeafBoxes(bound, leafBoxes, { closed, initialDiameter: Number(logicalBodyDiameter) });
    let compiled = prepareDepthPartitions(source, surface);
    let reason = depthReason;
    if (!await verifyDepthStyles(page, source, compiled, surface)) { compiled = source; reason = 'changed CSS cascade'; }
    if (!compiled.depthPartitions) reason ??= 'no decomposition within carrier budget';
    onDepthResult?.({ id: source.id, source, compiled, surface, reason });
    const activated = { ...compiled, tree: { ...compiled.tree, activationGroups: prepareActivationGroups(compiled) } };
    return withPreparedInteriorFill(activated, interior, assetRoot, gapExclusion);
  } finally { await page.close(); if (!suppliedBrowser) await browser.close(); }
}
