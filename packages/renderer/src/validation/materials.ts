import { array, attribute, boolean, choice, fail, finite, integer, numbers, positive, record, text, unique } from './guards.js';
import { nodeReference, resource, resourceList } from './resources-tree.js';
import type { PreparedMaterialTrack, PreparedMaterialSelection } from '../rendering/prepared-material.js';
import type { PreparedTree } from '../rendering/prepared-presentation.js';

export function requireMaterials(value: unknown, tree: PreparedTree, resources: ReadonlySet<string>): asserts value is readonly PreparedMaterialTrack[] {
  const tracks = array(value, 'materials'); unique(tracks.map(input => record(input, 'material').id), 'material tracks');
  for (const input of tracks) {
    const track = record(input, 'material', ['id', 'target', 'frame', 'defaultFrame', 'banks', 'rotation', 'frameAttribute', 'modeAttribute', 'quoted', 'farBank']);
    text(track.id, 'track id'); const target = nodeReference(track.target, tree);
    if ([tree.camera, tree.scene].includes(target)) fail('material target cannot own camera transforms');
    const mapping = record(track.frame, 'frame mapping', ['count', 'thresholds', 'indices']);
    const count = integer(mapping.count, 'frame count', 1), thresholds = numbers(mapping.thresholds, 'phase thresholds');
    if (thresholds.some((phase, index) => phase < -1 || phase > 1 || index > 0 && phase <= thresholds[index - 1])) fail('phase thresholds must increase within light domain');
    const indices = array(mapping.indices, 'phase frames');
    if (indices.length !== thresholds.length + 1 || indices.some(frame => integer(frame, 'phase frame') >= count)) fail('phase frames must address prepared bank');
    if (integer(track.defaultFrame, 'default frame') >= count) fail('default frame is outside addresses');
    const banks = array(track.banks, 'material banks').map(input => record(input, 'bank', ['id', 'frames', 'default', 'fixed', 'rows']));
    if (!banks.length) fail('material banks are empty'); unique(banks.map(bank => bank.id), 'material banks');
    for (const bank of banks) {
      text(bank.id, 'bank id'); const frames = array(bank.frames, 'frame addresses');
      // A fixed-only bank (a lens's one shadowless frame) carries its fixed address and no frames.
      if (frames.length !== count && !(frames.length === 0 && bank.fixed !== null && bank.rows === undefined)) fail('every material frame requires an address');
      frames.forEach((input, index) => { address(input, resources); if (record(input, 'address').frame !== index) fail('frame addresses must be ordered'); });
      if (bank.default !== null) address(bank.default, resources);
      if (bank.fixed !== null) address(bank.fixed, resources);
      if (bank.rows !== undefined) array(bank.rows, 'prepared rows').forEach((input, index) => {
        const row = record(input, 'prepared row', ['row', 'resource', 'firstFrame', 'lastFrame']);
        if (row.row !== index) fail('prepared rows must be ordered'); resource(row.resource, resources);
        const first = integer(row.firstFrame, 'first row frame'), last = integer(row.lastFrame, 'last row frame');
        if (first > last || last >= frames.length) fail('prepared row extent is invalid');
        for (let frame = first; frame <= last; frame++) {
          const item = record(frames[frame], 'frame'); if (item.row !== index || item.resource !== row.resource) fail('row and frame addresses disagree');
        }
      });
    }
    if (track.farBank !== undefined) {
      text(track.farBank, 'far bank'); const far = banks.find(bank => bank.id === track.farBank);
      if (!far || !array(far.rows, 'far rows').length || !far.fixed) fail('far bank needs rows and fixed address');
    }
    if (track.rotation !== null && track.rotation !== undefined) rotation(track.rotation);
    if (track.frameAttribute !== null && track.frameAttribute !== undefined) attribute(track.frameAttribute);
    if (track.modeAttribute !== null && track.modeAttribute !== undefined) attribute(track.modeAttribute);
    boolean(track.quoted, 'material quote mode');
  }
}
function address(value: unknown, resources: ReadonlySet<string>): void {
  const item = record(value, 'address', ['resource', 'frame', 'row', 'backgroundPosition', 'backgroundSize', 'prewarm']);
  resource(item.resource, resources, true);
  if (item.prewarm !== undefined) resourceList(item.prewarm, resources, 'neighboring rows');
  if (item.frame !== null) integer(item.frame, 'address frame'); if (item.row !== null) integer(item.row, 'address row');
  text(item.backgroundPosition, 'background position'); text(item.backgroundSize, 'background size');
}
function rotation(value: unknown): void {
  const item = record(value, 'rotation', ['kind', 'reference', 'baseDegrees', 'zeroAtPole', 'property', 'width', 'height', 'projection', 'polePolicy', 'systemTransform', 'onlyWhenEnabled', 'publishWithAddress', 'physical']);
  const kind = choice(item.kind, ['angle', 'planar', 'ellipsoid'], 'rotation kind');
  choice(item.reference, ['prepared', 'initial'], 'rotation reference'); finite(item.baseDegrees, 'rotation base'); boolean(item.zeroAtPole, 'pole rotation policy');
  for (const key of ['onlyWhenEnabled', 'publishWithAddress']) if (item[key] !== undefined) boolean(item[key], key);
  if (item.systemTransform !== undefined || kind === 'ellipsoid') text(item.systemTransform, 'rotation system transform');
  if (item.polePolicy !== undefined) choice(item.polePolicy, ['azimuth'], 'pole policy');
  if (kind === 'angle') text(item.property, 'angle property');
  else { positive(item.width, 'rotation width'); positive(item.height, 'rotation height'); }
  if (item.physical!==undefined){
    const physical=record(item.physical,'physical material projection',['width','height','systemTransform','projection']);
    positive(physical.width,'physical material width');positive(physical.height,'physical material height');text(physical.systemTransform,'physical material system transform');
    ellipsoidProjection(physical.projection);
  }
  if (kind === 'ellipsoid') ellipsoidProjection(item.projection);
}
function ellipsoidProjection(value:unknown):void{
    const projection = record(value, 'ellipsoid projection', ['equatorialRadius', 'polarRadius', 'coverageScale', 'bodySystemMatrix', 'bodyMeshMatrix', 'materialSystemMatrix', 'materialMeshMatrix', 'baseProjection', 'centerTranslation', 'inverseCenterTranslation', 'counterPrecision', 'counterFractionDigits', 'counterFractionScale','textureEllipse']);
    for (const key of ['equatorialRadius', 'polarRadius', 'coverageScale']) positive(projection[key], key);
    for (const key of ['bodySystemMatrix', 'bodyMeshMatrix', 'materialSystemMatrix', 'materialMeshMatrix', 'baseProjection', 'centerTranslation', 'inverseCenterTranslation']) numbers(projection[key], key, 16);
    if (projection.counterPrecision !== undefined && integer(projection.counterPrecision, 'counter precision', 1) > 16) fail('counter precision must be bounded');
    if (projection.counterFractionDigits !== undefined && (integer(projection.counterFractionDigits, 'fraction precision', 1) > 16 ||
      !(positive(projection.counterFractionScale, 'fraction scale') > 0) || projection.counterPrecision === undefined)) fail('fraction precision must be bounded');
    if (projection.counterFractionScale !== undefined && projection.counterFractionDigits === undefined) fail('fraction scale requires precision');
    if(projection.textureEllipse!==undefined){
      const ellipse=record(projection.textureEllipse,'texture ellipse',['center','covariance']);numbers(ellipse.center,'texture ellipse center',2);
      const [xx,xy,yy]=numbers(ellipse.covariance,'texture ellipse covariance',3);
      if(!(xx>0)||!(xx*yy-xy*xy>0))fail('texture ellipse covariance must be positive definite');
    }
}
export function requireSelectedMaterial(value: unknown, tracks: readonly PreparedMaterialTrack[]): asserts value is PreparedMaterialSelection {
  const selected = record(value, 'selected material', ['track', 'bank', 'mode', 'enabled', 'rotationEnabled', 'frameOverride', 'frameOffset', 'clearWhenHidden', 'fixedMode', 'modeLabel', 'addressAttributes', 'publishWhenHidden']);
  const track = tracks.find(track => track.id === selected.track), bank = track?.banks.find(bank => bank.id === selected.bank);
  if (!track || !bank) fail('undeclared selected material bank');
  const count = bank.frames.length, mode = choice(selected.mode, ['frames', 'fixed'], 'selected material mode');
  for (const key of ['enabled', 'rotationEnabled', 'clearWhenHidden']) boolean(selected[key], `selected ${key}`);
  if (selected.frameOverride !== null && integer(selected.frameOverride, 'frame override') >= count) fail('frame override is outside addresses');
  if (selected.frameOffset !== undefined) {
    const offset = integer(selected.frameOffset, 'frame offset'), maximum = Math.max(...track.frame.indices);
    if (offset > 0 && offset <= maximum || offset + maximum >= count) fail('frame offset is outside addresses');
  }
  if (selected.publishWhenHidden !== undefined) choice(selected.publishWhenHidden, ['always', 'static', 'never'], 'hidden address publication');
  text(selected.fixedMode, 'fixed mode'); if (selected.modeLabel !== undefined) text(selected.modeLabel, 'mode label');
  for (const input of array(selected.addressAttributes ?? [], 'address attributes')) {
    const binding = record(input, 'address attribute', ['name', 'source', 'value']); attribute(binding.name);
    const source = choice(binding.source, ['frame', 'mode', 'mode-or-frame', 'literal'], 'address attribute source');
    if (source !== 'literal' && binding.value !== null) fail('address value must be literal or null');
    if (binding.value !== null) text(binding.value, 'address value', true);
  }
  if (mode === 'fixed' && !bank.fixed) fail('selected mode requires prepared address');
  if (mode !== 'fixed' && !bank.frames.length) fail('a fixed-only bank is selected only in fixed mode');
}
