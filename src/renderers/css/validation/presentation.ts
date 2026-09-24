import { array, attribute, boolean, choice, fail, finite, integer, positive, record, text, unique } from './guards.js';
import { ancestor, nodeReference, requireWrite, resourceList } from './resources-tree.js';
import { requireSelectedMaterial } from './materials.js';
import type { PreparedVariant, PreparedViewBinding, PreparedPresentationDefinition, PreparedTree } from '../rendering/prepared-presentation.js';
import type { PreparedMaterialTrack } from '../rendering/prepared-material.js';
import type { ObjectControls } from '../runtime/object-contract.js';
import type { CameraPlan } from '../navigation/types.js';

export { requireTextureLevels } from '../../../platform/prepared-texture-levels.mts';

export function requireVariants(value: unknown, tree: PreparedTree, resources: ReadonlySet<string>, tracks: readonly PreparedMaterialTrack[], controls: ObjectControls, camera: CameraPlan): asserts value is readonly PreparedVariant[] {
  const variants = array(value, 'selection variants'); if (!variants.length) fail('selection variants are empty');
  const lensIds = controls.lenses?.controls.map(lens => lens.id) ?? [], settings = new Map(controls.settings?.controls.map(setting => [setting.name, setting]) ?? []);
  const keys: Record<string, unknown>[] = [];
  const activationTargets = new Set(tree.activationGroups?.flat() ?? []);
  for (const input of variants) {
    const variant = record(input, 'variant', ['when', 'required', 'writes', 'materials', 'navigation', 'hiddenSubtrees']);
    if (variant.hiddenSubtrees !== undefined) {
      const containers = new Set(tree.nodes.map(node => node.parent)), hidden = new Set<number>();
      const holds = (root: number, id: number) => { for (let at: number = id; at >= 0; at = tree.nodes[at].parent) if (at === root) return true; return false; };
      for (const value of array(variant.hiddenSubtrees, 'hidden subtrees')) {
        const root = integer(value, 'hidden subtree');
        if (root >= tree.nodes.length || !containers.has(root) || holds(root, tree.camera) || holds(root, tree.scene) || hidden.has(root))
          fail('a hidden subtree must be a unique container outside the camera and scene path');
        hidden.add(root);
      }
    }
    const when = record(variant.when, 'selection key', ['lensId', ...settings.keys()]); keys.push(when);
    if (lensIds.length ? !lensIds.includes(text(when.lensId, 'variant lens')) : Object.hasOwn(when, 'lensId')) fail('variant must match the declared lens capability');
    for (const [key, value] of Object.entries(when)) if (key !== 'lensId') {
      if (settings.get(key)?.kind !== 'toggle') fail('variants may only bind discrete toggle settings'); boolean(value, 'variant toggle');
    }
    resourceList(variant.required, resources, 'selection resources');
    array(variant.writes, 'selection writes').forEach(write => requireWrite(write, tree, resources));
    for (const input of variant.writes as PreparedVariant['writes']) {
      if (input.kind === 'style' && input.name === 'display' && activationTargets.has(input.target)) fail('selection display cannot race prepared activation');
    }
    const materials = array(variant.materials, 'selected materials'); unique(materials.map(value => record(value, 'selected material').track), 'selected tracks');
    if (materials.length !== tracks.length) fail('each variant must specify every material track');
    materials.forEach(value => requireSelectedMaterial(value, tracks));
    if (variant.navigation !== undefined) {
      const navigation = record(variant.navigation, 'navigation', ['maximumZoom', 'camera']);
      const maximum = finite(navigation.maximumZoom, 'navigation maximum zoom');
      if (maximum < camera.minimumZoom || maximum > camera.maximumZoom) fail('navigation zoom must be bounded');
      if (navigation.camera !== null) {
        const pose = record(navigation.camera, 'navigation camera', ['controlPitch', 'controlYaw', 'controlRoll', 'zoom', 'transition']);
        if (pose.transition !== undefined) {
          const transition = record(pose.transition, 'camera transition', ['durationMilliseconds', 'preserveZoom']);
          const duration = finite(transition.durationMilliseconds, 'camera transition duration');
          if (duration < 0 || duration > 10000) fail('camera transition duration must be between 0 and 10 seconds');
          boolean(transition.preserveZoom, 'camera transition preserve zoom');
        }
        if (pose.controlRoll !== undefined) finite(pose.controlRoll, 'navigation roll');
        finite(pose.controlPitch, 'navigation pitch'); finite(pose.controlYaw, 'navigation yaw');
        const zoom = finite(pose.zoom, 'navigation zoom'); if (zoom < camera.minimumZoom || zoom > maximum) fail('navigation camera must be bounded');
      }
    }
  }
  const toggles = [...new Set(keys.flatMap(when => Object.keys(when).filter(key => key !== 'lensId')))];
  const declaredToggles = [...settings.values()].filter(setting => setting.kind === 'toggle').map(setting => setting.name);
  for (const name of declaredToggles) if (!toggles.includes(name)) fail(`setting ${name} has no prepared variant`);
  if (toggles.length > 12) fail('selection table exceeds bounded toggle combinations');
  // A toggle may apply only to compatible lenses, but it must change at least one prepared selection.
  const effective = new Set<string>();
  const effect = (variant: PreparedVariant) => JSON.stringify({ required: variant.required, writes: variant.writes,
    materials: variant.materials, navigation: variant.navigation });
  for (const lensId of lensIds.length ? lensIds : [null]) {
    const resolved: PreparedVariant[] = [];
    for (let bits = 0; bits < 2 ** toggles.length; bits++) {
      const state: Record<string, string | boolean | null> = {lensId, ...Object.fromEntries(toggles.map((name, bit) => [name, !!(bits & 2 ** bit)]))};
      const matching = variants.filter((variant, index) => Object.entries(keys[index]!).every(([key, value]) => state[key] === value));
      if (matching.length !== 1) fail('selection table must cover each combination exactly once');
      resolved.push(matching[0] as PreparedVariant);
    }
    for (const [bit, name] of toggles.entries()) {
      for (let bits = 0; bits < resolved.length; bits++) {
        if (bits & 2 ** bit) continue;
        if (effect(resolved[bits]!) !== effect(resolved[bits | 2 ** bit]!)) effective.add(name);
      }
    }
  }
  for (const name of declaredToggles) if (!effective.has(name)) fail(`setting ${name} has no prepared effect`);
}
export function requireViewBindings(value: unknown, tree: PreparedTree, camera: CameraPlan): asserts value is readonly PreparedViewBinding[] {
  for (const input of array(value, 'view bindings')) {
    const binding = record(input, 'view binding', ['kind', 'target', 'property', 'systemTransform', 'source', 'precision', 'minimumRadius', 'unitScale', 'hysteresis', 'levels', 'sceneFromBody', 'radii', 'inset']);
    const kind = choice(binding.kind, ['counter-rotation', 'view-attribute', 'view-property', 'silhouette-fit', 'silhouette-step-property', 'interior-disc'], 'view binding');
    const target = nodeReference(binding.target, tree, kind === 'view-attribute' || kind === 'view-property');
    if ([tree.camera, tree.scene].includes(target) && kind !== 'view-attribute') fail('view binding cannot duplicate camera publisher');
    if (kind === 'interior-disc') {
      const matrix = array(binding.sceneFromBody, 'interior disc frame').map(value => finite(value, 'interior disc frame'));
      const radii = array(binding.radii, 'interior disc radii').map(value => positive(value, 'interior disc radius'));
      if (matrix.length !== 16 || [3, 7, 11].some(index => matrix[index] !== 0) || matrix[15] !== 1 || radii.length !== 3 ||
          !(finite(binding.inset, 'interior disc inset') > 0 && Number(binding.inset) < 1) ||
          tree.nodes[target].parent !== tree.scene || camera.projection?.model !== 'css-perspective-shared-with-sky') fail('interior disc requires an affine frame inside the perspective scene');
    } else if (kind === 'silhouette-fit') {
      if (finite(binding.minimumRadius, 'silhouette floor') < 0 || !(positive(binding.unitScale, 'silhouette scale') > 0) || camera.projection?.model !== 'css-perspective-shared-with-sky') fail('silhouette fit requires perspective camera and scale');
    } else if (kind === 'silhouette-step-property') {
      if (!text(binding.property, 'silhouette step property').startsWith('--')) fail('silhouette step property must be custom');
      const hysteresis = finite(binding.hysteresis, 'silhouette step hysteresis');
      if (hysteresis < 0 || hysteresis >= 1) fail('silhouette step hysteresis must be in [0, 1)');
      const levels = array(binding.levels, 'silhouette steps');
      if (levels.length < 2 || levels.length > 64) fail('silhouette steps must hold 2 to 64 levels');
      let previous = -1;
      for (const [index, input] of levels.entries()) {
        const level = record(input, 'silhouette step', ['minimumDiameter', 'value']);
        const diameter = finite(level.minimumDiameter, 'silhouette step diameter'); text(level.value, 'silhouette step value');
        if (index === 0 ? diameter !== 0 : diameter <= previous) fail('silhouette steps must start at 0 and increase');
        previous = diameter;
      }
    } else if (kind === 'view-attribute' || kind === 'view-property') {
      if (kind === 'view-property') {
        if (!text(binding.property, 'view property').startsWith('--')) fail('view property must be custom');
        choice(binding.source, ['billboard-opacity', 'marker-opacity'], 'view property source');
      } else {
        attribute(binding.property); choice(binding.source, ['scene-pitch', 'control-yaw', 'zoom', 'scene-matrix', 'level-of-detail-stage'], 'view attribute source');
        if (target === -1 && binding.source !== 'level-of-detail-stage') fail('only level of detail is published on stage');
      }
      if (binding.precision !== null && (integer(binding.precision, 'view precision') > 12 || binding.source === 'scene-matrix')) fail('invalid view precision');
    } else if (binding.systemTransform !== null) text(binding.systemTransform, 'counter rotation transform', true);
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
export function requireFacing(value: unknown, tree: PreparedTree, partitionScenes: readonly number[] = []): void {
  const targets = new Set<number>();
  for (const item of array(value, 'facing planes')) {
    const face = record(item, 'facing plane', ['target', 'plane', 'tolerance']);
    positive(face.tolerance, 'native backface tolerance');
    const target = nodeReference(face.target, tree);
    if ([tree.camera, tree.scene].includes(target) || targets.has(target)) fail('facing target must be a unique prepared leaf');
    if (![tree.scene, ...partitionScenes].some(scene => ancestor(target, scene, tree))) fail('facing target must belong to scene');
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
  if (plan.surfaceHit !== undefined) {
    const hit = record(plan.surfaceHit, 'surface hit', ['target', 'triangles', 'frontFace', 'lensRanges']);
    if (hit.frontFace !== undefined && !['clockwise','counter-clockwise'].includes(hit.frontFace as string)) fail('invalid surface front face');
    if (!ancestor(nodeReference(hit.target, tree), tree.scene, tree)) fail('surface hit target must belong to scene');
    const triangles = array(hit.triangles, 'surface hit triangles');
    if (!triangles.length || triangles.length > 10000) fail('surface hit mesh exceeds its bounds');
    if (hit.lensRanges !== undefined) {
      const ranges = array(hit.lensRanges, 'surface lens ranges');
      if (ranges.length !== lensIds.length) fail('surface ranges must cover every lens');
      unique(ranges.map(value => record(value, 'surface lens range').lensId), 'surface lens ranges');
      for (const value of ranges) {
        const range = record(value, 'surface lens range', ['lensId', 'start', 'count']);
        if (!lensIds.includes(text(range.lensId, 'surface lens')) || !Number.isSafeInteger(range.start) || Number(range.start) < 0 ||
            !Number.isSafeInteger(range.count) || Number(range.count) < 1 || Number(range.start) + Number(range.count) > triangles.length) fail('invalid surface lens range');
      }
    }
    for (const input of triangles) {
      const triangle = array(input, 'surface triangle');
      if (triangle.length !== 3) fail('surface triangle needs three points');
      for (const value of triangle) {
        const point = array(value, 'surface point');
        if (point.length !== 3) fail('surface point needs three coordinates');
        point.forEach(n => finite(n, 'surface coordinate'));
      }
    }
  }
  if (plan.motionFrame !== undefined) {
    const frame = array(plan.motionFrame, 'motion frame'); if (!frame.length) fail('motion frame is empty'); unique(frame, 'motion frame');
    for (const value of frame) if (!ancestor(nodeReference(value, tree), tree.scene, tree)) fail('motion frame must belong to scene');
  }
  if (plan.destinations !== undefined) {
    const destinations = record(plan.destinations, 'destinations', ['catalog', 'defaultLens', 'statuses']), catalog = record(destinations.catalog, 'destination catalog');
    if (!text(catalog.url, 'catalog URL').startsWith('/scenes/') || !/^[a-f0-9]{64}$/.test(text(catalog.sha256, 'catalog hash')) || !lensIds.includes(text(destinations.defaultLens, 'destination lens'))) fail('destinations require pinned catalog and declared lens');
    integer(catalog.bytes, 'catalog bytes', 1); integer(catalog.count, 'catalog count', 1);
    const statuses = record(destinations.statuses, 'destination statuses', ['detail', 'overview']); text(statuses.detail, 'detail status'); text(statuses.overview, 'overview status');
  }
  if (plan.features !== undefined) requireSurfaceFeatures(plan.features, tree, lensIds);
}

/** Prepared nomenclature labels: a pinned catalogue anchored to one scene mesh, shown for declared lenses. */
export function requireSurfaceFeatures(value: unknown, tree: PreparedTree, lensIds: readonly string[]): void {
  const features = record(value, 'surface features', ['catalog', 'selection', 'target', 'lensIds', 'meshRadiusUnits', 'policy', 'outline', 'surfaceRadiusUnits', 'surfaceEllipsoidUnits']);
  const catalog = record(features.catalog, 'surface feature catalog', ['url', 'bytes', 'sha256', 'count']);
  if (!text(catalog.url, 'feature catalog URL').startsWith('/scenes/') || !/^[a-f0-9]{64}$/.test(text(catalog.sha256, 'feature catalog hash'))) fail('surface features require a pinned catalogue');
  integer(catalog.bytes, 'feature catalog bytes', 1); integer(catalog.count, 'feature catalog count', 1);
  if (features.selection !== undefined) {
    const selection = record(features.selection, 'surface feature selection', ['count', 'banks']);
    const count = integer(selection.count, 'surface feature selection count', 1);
    const banks = array(selection.banks, 'surface feature selection banks');
    if (!banks.length || banks.length > 256) fail('surface feature selection banks are out of range');
    let found = 0;
    const urls: string[] = [];
    for (const [index, value] of banks.entries()) {
      const bank = record(value, `surface feature selection bank ${index}`, ['url', 'bytes', 'sha256', 'count']);
      const url = text(bank.url, 'feature selection bank URL');
      if (!url.startsWith('/scenes/') || !/^[a-f0-9]{64}$/.test(text(bank.sha256, 'feature selection bank hash'))) fail('surface feature selection requires pinned banks');
      integer(bank.bytes, 'feature selection bank bytes', 1); found += integer(bank.count, 'feature selection bank count', 1); urls.push(url);
    }
    unique(urls, 'surface feature selection bank URLs');
    if (found !== count) fail('surface feature selection bank counts drifted');
  }
  if (!ancestor(nodeReference(features.target, tree), tree.scene, tree)) fail('surface feature target must belong to scene');
  const lenses = array(features.lensIds, 'surface feature lenses').map(id => text(id, 'surface feature lens'));
  unique(lenses, 'surface feature lenses');
  if (!lenses.length || lenses.some(id => !lensIds.includes(id))) fail('surface features require declared lenses');
  positive(features.meshRadiusUnits, 'surface feature mesh radius');
  if (features.surfaceRadiusUnits !== undefined) {
    const band = record(features.surfaceRadiusUnits, 'surface feature radius band', ['minimum', 'maximum']);
    const minimum = positive(band.minimum, 'surface feature radius minimum'), maximum = positive(band.maximum, 'surface feature radius maximum');
    if (maximum < minimum) fail('surface feature radius band is inverted');
  }
  if (features.surfaceEllipsoidUnits !== undefined) {
    if (features.surfaceRadiusUnits !== undefined) fail('surface features declare one surface model');
    const ellipsoid = record(features.surfaceEllipsoidUnits, 'surface feature ellipsoid', ['equatorial', 'polar', 'north', 'minimumShare', 'maximumShare']);
    const equatorial = positive(ellipsoid.equatorial, 'surface feature equatorial semi-axis'), polar = positive(ellipsoid.polar, 'surface feature polar semi-axis');
    if (polar > equatorial || Math.abs(equatorial - Number(features.meshRadiusUnits)) > 1e-6 * equatorial) fail('surface feature ellipsoid semi-axes must fit the mesh radius');
    const north = array(ellipsoid.north, 'surface feature polar axis').map(n => finite(n, 'surface feature polar axis'));
    if (north.length !== 3 || Math.abs(Math.hypot(north[0]!, north[1]!, north[2]!) - 1) > 1e-9) fail('surface feature polar axis must be a unit axis');
    const minimumShare = positive(ellipsoid.minimumShare, 'surface feature ellipsoid minimum share'), maximumShare = positive(ellipsoid.maximumShare, 'surface feature ellipsoid maximum share');
    if (minimumShare > 1 || maximumShare < 1 || maximumShare < minimumShare) fail('surface feature ellipsoid band must contain the reference surface');
  }
  const policy = record(features.policy, 'surface feature policy', ['minimumZoomShare', 'minimumDiameterPixels', 'alwaysVisibleCount', 'maximumVisible', 'limbCosine']);
  const share = finite(policy.minimumZoomShare, 'surface feature zoom share'); if (share < 0 || share > 1) fail('surface feature zoom share is out of range');
  positive(policy.minimumDiameterPixels, 'surface feature size floor'); integer(policy.alwaysVisibleCount, 'surface feature head count');
  integer(policy.maximumVisible, 'surface feature cap', 1);
  const limb = finite(policy.limbCosine, 'surface feature limb cosine'); if (limb < 0 || limb >= 1) fail('surface feature limb cosine is out of range');
  const outline = record(features.outline, 'surface feature outline', ['pieces']);
  integer(outline.pieces, 'surface feature outline pieces', 8); if (Number(outline.pieces) > 512) fail('surface feature outline pool is too large');
}
