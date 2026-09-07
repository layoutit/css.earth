import { array, attribute, boolean, choice, fail, finite, integer, positive, record, text, unique } from './guards.js';
import { ancestor, nodeReference, requireWrite, resourceList } from './resources-tree.js';
import { requireSelectedMaterial } from './materials.js';
import type { PreparedVariant, PreparedViewBinding, PreparedPresentationDefinition, PreparedTree } from '../rendering/prepared-presentation.js';
import type { PreparedMaterialTrack } from '../rendering/prepared-material.js';
import type { ObjectControls } from '../runtime/object-contract.js';
import type { CameraPlan } from '../navigation/types.js';
import { parsePreparedPagePlan } from '../paging/capabilities.js';

export function requireVariants(value: unknown, tree: PreparedTree, resources: ReadonlySet<string>, tracks: readonly PreparedMaterialTrack[], controls: ObjectControls, camera: CameraPlan): asserts value is readonly PreparedVariant[] {
  const variants = array(value, 'selection variants'); if (!variants.length) fail('selection variants are empty');
  const lensIds = controls.lenses?.controls.map(lens => lens.id) ?? [], settings = new Map(controls.settings?.controls.map(setting => [setting.name, setting]) ?? []);
  const keys: Record<string, unknown>[] = [];
  for (const input of variants) {
    const variant = record(input, 'variant', ['when', 'required', 'writes', 'materials', 'navigation']);
    const when = record(variant.when, 'selection key', ['lensId', ...settings.keys()]); keys.push(when);
    if (lensIds.length ? !lensIds.includes(text(when.lensId, 'variant lens')) : Object.hasOwn(when, 'lensId')) fail('variant must match the declared lens capability');
    for (const [key, value] of Object.entries(when)) if (key !== 'lensId') {
      if (settings.get(key)?.kind !== 'toggle') fail('variants may only bind discrete toggle settings'); boolean(value, 'variant toggle');
    }
    resourceList(variant.required, resources, 'selection resources');
    array(variant.writes, 'selection writes').forEach(write => requireWrite(write, tree, resources));
    const materials = array(variant.materials, 'selected materials'); unique(materials.map(value => record(value, 'selected material').track), 'selected tracks');
    if (materials.length !== tracks.length) fail('each variant must specify every material track');
    materials.forEach(value => requireSelectedMaterial(value, tracks));
    if (variant.navigation !== undefined) {
      const navigation = record(variant.navigation, 'navigation', ['maximumZoom', 'camera']);
      const maximum = finite(navigation.maximumZoom, 'navigation maximum zoom');
      if (maximum < camera.minimumZoom || maximum > camera.maximumZoom) fail('navigation zoom must be bounded');
      if (navigation.camera !== null) {
        const pose = record(navigation.camera, 'navigation camera', ['controlPitch', 'controlYaw', 'zoom']);
        finite(pose.controlPitch, 'navigation pitch'); finite(pose.controlYaw, 'navigation yaw');
        const zoom = finite(pose.zoom, 'navigation zoom'); if (zoom < camera.minimumZoom || zoom > maximum) fail('navigation camera must be bounded');
      }
    }
  }
  const toggles = [...new Set(keys.flatMap(when => Object.keys(when).filter(key => key !== 'lensId')))];
  if (toggles.length > 12) fail('selection table exceeds bounded toggle combinations');
  for (const lensId of lensIds.length ? lensIds : [null]) for (let bits = 0; bits < 2 ** toggles.length; bits++) {
    const state: Record<string, string | boolean | null> = {lensId, ...Object.fromEntries(toggles.map((name, bit) => [name, !!(bits & 2 ** bit)]))};
    if (keys.filter(when => Object.entries(when).every(([key, value]) => state[key] === value)).length !== 1) fail('selection table must cover each combination exactly once');
  }
}
export function requireViewBindings(value: unknown, tree: PreparedTree, camera: CameraPlan): asserts value is readonly PreparedViewBinding[] {
  for (const input of array(value, 'view bindings')) {
    const binding = record(input, 'view binding', ['kind', 'target', 'property', 'variable', 'defaultZoom', 'systemTransform', 'source', 'precision', 'minimumRadius', 'unitScale']);
    const kind = choice(binding.kind, ['zoom-property', 'shell-scale', 'counter-rotation', 'view-attribute', 'view-property', 'silhouette-fit'], 'view binding');
    const target = nodeReference(binding.target, tree, kind === 'view-attribute' || kind === 'view-property');
    if ([tree.camera, tree.scene].includes(target) && kind !== 'view-attribute') fail('view binding cannot duplicate camera publisher');
    if (kind === 'silhouette-fit') {
      if (finite(binding.minimumRadius, 'silhouette floor') < 0 || !(positive(binding.unitScale, 'silhouette scale') > 0) || camera.projection?.model !== 'css-perspective-shared-with-sky') fail('silhouette fit requires perspective camera and scale');
    } else if (kind === 'view-attribute' || kind === 'view-property') {
      if (kind === 'view-property') {
        if (!text(binding.property, 'view property').startsWith('--')) fail('view property must be custom');
        choice(binding.source, ['billboard-opacity', 'marker-opacity'], 'view property source');
      } else {
        attribute(binding.property); choice(binding.source, ['scene-pitch', 'control-yaw', 'zoom', 'scene-matrix', 'level-of-detail-stage'], 'view attribute source');
        if (target === -1 && binding.source !== 'level-of-detail-stage') fail('only level of detail is published on stage');
      }
      if (binding.precision !== null && (integer(binding.precision, 'view precision') > 12 || binding.source === 'scene-matrix')) fail('invalid view precision');
    } else if (kind === 'zoom-property') text(binding.property, 'zoom property');
    else if (kind === 'shell-scale') { text(binding.variable, 'shell variable'); positive(binding.defaultZoom, 'shell default zoom'); }
    else if (binding.systemTransform !== null) text(binding.systemTransform, 'counter rotation transform', true);
  }
}
export function requireAnimations(value: unknown, tree: PreparedTree, motion = false): asserts value is PreparedPresentationDefinition['animations'] {
  for (const input of array(value, 'animations')) {
    const animation = record(input, 'animation', motion ? ['target', 'id', 'keyframes', 'duration', 'timings'] : ['target', 'id', 'keyframes', 'duration', 'mode', 'sourceMinimum', 'millisecondsPerDegree']);
    const target = nodeReference(animation.target, tree); text(animation.id, 'animation id');
    if ([tree.camera, tree.scene].includes(target)) fail('prepared animation cannot target camera or scene');
    positive(animation.duration, 'animation duration');
    if (motion) for (const item of array(animation.timings, 'motion timings')) {
      const timing = record(item, 'motion timing', ['when', 'duration']);
      positive(timing.duration, 'motion duration');
      const when = timing.when;
      if (!when || typeof when !== 'object' || Array.isArray(when) || Object.values(when).some(value => !['string', 'boolean', 'number'].includes(typeof value))) fail('motion timing needs a selection');
    }
    if (!motion) {
      choice(animation.mode, ['pose'], 'prepared animation mode');
      finite(animation.sourceMinimum, 'animation minimum'); finite(animation.millisecondsPerDegree, 'animation time mapping');
    }
    const frames = array(animation.keyframes, 'keyframes'); if (!frames.length) fail('prepared animation has no keyframes');
    for (const input of frames) {
      const frame = record(input, 'keyframe', ['offset', 'transform']);
      const offset = finite(frame.offset, 'keyframe offset'); if (offset < 0 || offset > 1) fail('keyframe offset must be within animation');
      text(frame.transform, 'keyframe transform');
    }
  }
}
export function requireFacing(value: unknown, tree: PreparedTree): void {
  const targets = new Set<number>();
  for (const item of array(value, 'facing planes')) {
    const face = record(item, 'facing plane', ['target', 'plane', 'tolerance']);
    positive(face.tolerance, 'native backface tolerance');
    const target = nodeReference(face.target, tree);
    if ([tree.camera, tree.scene].includes(target) || targets.has(target)) fail('facing target must be a unique prepared leaf');
    if (!ancestor(target, tree.scene, tree)) fail('facing target must belong to scene');
    if (tree.nodes.some(node => node.parent === target)) fail('facing target must be a leaf');
    targets.add(target);
    const plane = array(face.plane, 'facing plane coordinates');
    if (plane.length !== 4) fail('facing plane needs four coordinates');
    plane.forEach(value => finite(value, 'facing plane coordinate'));
    if (Math.abs(Math.hypot(...plane.slice(0, 3) as number[]) - 1) > 1e-6) fail('facing plane must have a unit normal');
  }
}
export function requireOptionalPresentation(plan: Record<string, unknown>, tree: PreparedTree, controls: ObjectControls): void {
  const lensIds = controls.lenses?.controls.map(lens => lens.id) ?? [];
  if (plan.motionFrame !== undefined) {
    const frame = array(plan.motionFrame, 'motion frame'); if (!frame.length) fail('motion frame is empty'); unique(frame, 'motion frame');
    for (const value of frame) if (!ancestor(nodeReference(value, tree), tree.scene, tree)) fail('motion frame must belong to scene');
  }
  if (plan.pageLayers !== undefined) {
    const layers = array(plan.pageLayers, 'page layers'); unique(layers.map(value => record(value, 'page layer').id), 'page layers');
    for (const input of layers) {
      const layer = record(input, 'page layer', ['id', 'plan', 'carrier', 'system', 'className', 'textureClassName', 'lensIds']);
      for (const key of ['id', 'className', 'textureClassName']) text(layer[key], `page layer ${key}`);
      const carrier = nodeReference(layer.carrier, tree), system = nodeReference(layer.system, tree);
      if (!ancestor(carrier, tree.scene, tree) || !ancestor(system, tree.scene, tree) || !ancestor(carrier, system, tree)) fail('page carrier must belong to scene and system');
      const lenses = array(layer.lensIds, 'page lenses').map(id => text(id, 'page lens'));
      if (!lenses.length || lenses.some(id => !lensIds.includes(id))) fail('page layer requires declared lenses');
      parsePreparedPagePlan(layer.plan, { lensIds: lenses });
    }
  }
  if (plan.destinations !== undefined) {
    const destinations = record(plan.destinations, 'destinations', ['catalog', 'defaultLens', 'statuses']), catalog = record(destinations.catalog, 'destination catalog');
    if (!text(catalog.url, 'catalog URL').startsWith('/scenes/') || !/^[a-f0-9]{64}$/.test(text(catalog.sha256, 'catalog hash')) || !lensIds.includes(text(destinations.defaultLens, 'destination lens'))) fail('destinations require pinned catalog and declared lens');
    integer(catalog.bytes, 'catalog bytes', 1); integer(catalog.count, 'catalog count', 1);
    const statuses = record(destinations.statuses, 'destination statuses', ['detail', 'overview']); text(statuses.detail, 'detail status'); text(statuses.overview, 'overview status');
  }
}
