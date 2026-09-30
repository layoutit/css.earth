/**
 * Merge prepared catalogue point banks into one bank of dots, drawn by the app like its other stars: projected every
 * frame, sharp at any zoom. `source/<id>/merge.json` lists the banks; each keeps its catalogue colour, and its opacity
 * darkens that colour, so every dot is opaque and only its colour carries its tone. An entry may be `{ bank, withinPcOfCentre, keepEvery, basis }`: only points within that
 * distance of the galaxy's centre (its volume or image-layer frame origin), and one in `keepEvery` of those in catalogue order.
 * A kinematic distance whose uncertainty (prepare-catalogue-points.mts `kinematicUncertainty`) exceeds `maxKinematicSigmaKpc` is left
 * out: those are the sources the rotation curve cannot place, and they pile onto a circle through the Sun and the
 * centre. `colourTowardWhite` mixes each colour that fraction of the way to white first (presentation: the catalogue
 * colours read as tints of starlight, not saturated signs). `colourGamma` then raises each colour channel to that power
 * (presentation: it deepens the coloured dots so they sit in the galaxy's backing while the whitest keep their
 * sparkle). A bank's `paletteTone` (prepare-catalogue-points.mts `toneBy`) then scales each colour, so a dimmer object is
 * a darker dot. The points are written in a fixed shuffled order, so a thinned prefix thins every region alike.
 * `centreOnGalaxy` writes them around the galaxy's centre instead of the Sun (same axes and unit): the app thins a bank
 * by the camera's distance from its origin, so another galaxy's dots must have that galaxy as their origin.
 *
 * `densityCap` evens the dots across space. Every catalogue is complete only out to some distance from the Sun, so
 * together they pile up around it. A point is kept, in the shuffled order, while fewer dots already kept lie within the
 * kernel of it than the cap allows there. Regions the catalogues leave sparser stay as they are. The cap is either
 * - a galaxy's disc, seen face-on (kpc banks): `atSunPerKpc2` at the Sun's radius, exponential in Galactocentric radius
 *   with `scaleLengthKpc`, counted within `kernelKpc`; or
 * - the universe, in 3D (Mpc banks): `perMpc3` everywhere, counted within `kernelMpc`.
 * A volume cap may count per spherical shell around the Sun instead (`shellMpc`, the shell's width): each shell keeps
 * its galaxies up to the cap times the shell's volume less what the enclosing levels draw there, so a cluster keeps its
 * contrast with its surroundings and only the catalogue's fall-off with distance is evened. With `groupsFirst` (banks
 * whose points carry their `groups`, prepare-catalogue-points.mts `groupDistance`), a shell's room goes first to members
 * of groups of two or more, the richest group first, then a random share of the rest (`background` times the room,
 * again) fills the space between them; `wholeGroupsOf` keeps every member of a group that large, room or not, so a
 * cluster is whole from wherever it is seen.
 * With a taper (`taperKpc` or `taperMpc`: [from, to]) the cap falls linearly to nothing between those distances from
 * the Sun: a nested level of denser dots around the Sun, with a soft edge. `within` names the enclosing levels, already
 * merged: their dots count toward this level's cap and are not drawn again, so a level only adds dots, and nested
 * levels never draw one twice or stack their densities. stack-catalogue-points.mts joins the levels into the bank the app draws.
 *
 * Usage: node packages/bake/cli/merge-catalogue-points.mts <object-directory> <id>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { readCatalogueBank, recipePublished, selectByShell, writeCatalogueBank } from '@cssearth/bake/volume/node';

const KPC_M = 3.0856775814913673e19, MPC_M = 3.0856775814913673e22;
const [objectArgument, id] = process.argv.slice(2);
if (!objectArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: merge-catalogue-points.mts <object-directory> <id>');
const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared');
const recipePath = resolve(objectDirectory, 'source', id, 'merge.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as Record<string, unknown>;
const fail = (message: string): never => { throw new TypeError(`${recipePath}: ${message}`); };
const positive = (value: unknown) => typeof value === 'number' && value > 0;
const text = (value: unknown) => typeof value === 'string' && value.length > 0;
const pair = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value[0] >= 0 && value[1] > value[0];

type Entry = { bank: string; withinPcOfCentre?: number; keepEvery?: number; basis?: string };
const bankId = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/u.test(value);
const entry = (value: unknown): value is string | Entry => bankId(value) || (typeof value === 'object' && value !== null && bankId((value as Entry).bank) &&
  text((value as Entry).basis) && ((value as Entry).withinPcOfCentre === undefined || positive((value as Entry).withinPcOfCentre)) &&
  ((value as Entry).keepEvery === undefined || (Number.isInteger((value as Entry).keepEvery) && (value as Entry).keepEvery! >= 1)));
if (recipe.schema !== 'cssearth-catalogue-points-merge@1' || recipe.id !== id) fail(`needs schema cssearth-catalogue-points-merge@1 and id ${id}.`);
if (!Array.isArray(recipe.banks) || !recipe.banks.length || !recipe.banks.every(entry)) fail('banks lists bank ids or { bank, withinPcOfCentre?, keepEvery?, basis } entries.');
if (!text(recipe.meaning)) fail('needs its meaning.');
if ((recipe.maxKinematicSigmaKpc !== undefined || recipe.maxKinematicSigmaBasis !== undefined) && (!positive(recipe.maxKinematicSigmaKpc) || !text(recipe.maxKinematicSigmaBasis))) {
  fail('maxKinematicSigmaKpc is a positive number with its basis.');
}
if (recipe.colourGamma !== undefined && (!positive(recipe.colourGamma) || !text(recipe.colourGammaBasis))) fail('colourGamma is positive, with its basis.');
if (recipe.colourTowardWhite !== undefined && (typeof recipe.colourTowardWhite !== 'number' || !(recipe.colourTowardWhite >= 0 && recipe.colourTowardWhite < 1) ||
  !text(recipe.colourTowardWhiteBasis))) fail('colourTowardWhite is a fraction from 0 to 1, with its basis.');

type DiscCap = { mode: 'disc'; atSunPerKpc2: number; scaleLengthKpc: number; kernel: number; taper?: [number, number] };
type VolumeCap = { mode: 'volume'; perMpc3: number; kernel: number; shell?: number; taper?: [number, number];
  groupsFirst?: { background: number; wholeGroupsOf?: number } };
const cap = ((): DiscCap | VolumeCap | undefined => {
  const value = recipe.densityCap as Record<string, unknown> | undefined;
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || !text(value.basis)) return fail('densityCap needs its basis.');
  if (value.perMpc3 !== undefined) {
    if (!positive(value.perMpc3) || (positive(value.kernelMpc) === positive(value.shellMpc)) || (value.taperMpc !== undefined && !pair(value.taperMpc))) {
      fail('a volume densityCap needs positive perMpc3, one of kernelMpc or shellMpc, and an optional increasing taperMpc pair.');
    }
    const groups = value.groupsFirst as { background?: unknown; wholeGroupsOf?: unknown; basis?: unknown } | undefined;
    if (groups !== undefined && (!positive(value.shellMpc) || typeof groups !== 'object' || groups === null || typeof groups.background !== 'number' || !(groups.background >= 0)
      || (groups.wholeGroupsOf !== undefined && !(Number.isSafeInteger(groups.wholeGroupsOf) && (groups.wholeGroupsOf as number) >= 2)) || !text(groups.basis))) {
      fail('groupsFirst needs shellMpc, a background share of at least 0, an optional wholeGroupsOf of at least 2, and its basis.');
    }
    return { mode: 'volume', perMpc3: value.perMpc3 as number, kernel: (value.kernelMpc ?? value.shellMpc) as number,
      ...(positive(value.shellMpc) ? { shell: value.shellMpc as number } : {}), ...(value.taperMpc ? { taper: value.taperMpc as [number, number] } : {}),
      ...(groups ? { groupsFirst: { background: groups.background as number, ...(groups.wholeGroupsOf === undefined ? {} : { wholeGroupsOf: groups.wholeGroupsOf as number }) } } : {}) };
  }
  if (!positive(value.atSunPerKpc2) || !positive(value.scaleLengthKpc) || !positive(value.kernelKpc) || (value.taperKpc !== undefined && !pair(value.taperKpc))) {
    fail('a disc densityCap needs positive atSunPerKpc2, scaleLengthKpc and kernelKpc, and an optional increasing taperKpc pair.');
  }
  return { mode: 'disc', atSunPerKpc2: value.atSunPerKpc2 as number, scaleLengthKpc: value.scaleLengthKpc as number, kernel: value.kernelKpc as number,
    ...(value.taperKpc ? { taper: value.taperKpc as [number, number] } : {}) };
})();
if (recipe.within !== undefined && (!Array.isArray(recipe.within) || !recipe.within.every(bankId))) fail('within lists the enclosing levels\' ids.');

const entries = (recipe.banks as (string | Entry)[]).map(value => typeof value === 'string' ? { bank: value } as Entry : value);
const maxSigma = recipe.maxKinematicSigmaKpc as number | undefined, colourGamma = (recipe.colourGamma as number | undefined) ?? 1;
const towardWhite = (recipe.colourTowardWhite as number | undefined) ?? 0;
const graded = (colour: string) => '#' + [1, 3, 5].map(i => {
  const channel = parseInt(colour.slice(i, i + 2), 16) / 255;
  return Math.round(255 * (channel + (1 - channel) * towardWhite) ** colourGamma).toString(16).padStart(2, '0');
}).join('');
const toned = (colour: string, tone: number) => tone === 1 ? colour
  : '#' + [1, 3, 5].map(i => Math.round(parseInt(colour.slice(i, i + 2), 16) * tone).toString(16).padStart(2, '0')).join('');
// The galaxy's centre: its volume frame origin, read only by the rules that need it.
const centreOnGalaxy = recipe.centreOnGalaxy === true;
if (recipe.centreOnGalaxy !== undefined && (typeof recipe.centreOnGalaxy !== 'boolean' || cap)) fail('centreOnGalaxy is a boolean, for a bank without a density cap.');
const needsCentre = centreOnGalaxy || cap?.mode === 'disc' || entries.some(value => value.withinPcOfCentre !== undefined);
// A density-volume galaxy (prepared/volume.json) or one drawn as image layers (prepared/image-layers.json).
const galaxyFrameValue = async () => {
  const volume = await readFile(resolve(prepared, 'volume.json'), 'utf8').catch(() => null);
  return volume === null ? (JSON.parse(await readFile(resolve(prepared, 'image-layers.json'), 'utf8')) as { frame?: unknown }).frame
    : (JSON.parse(volume) as { data?: { frame?: unknown } }).data?.frame;
};
const galaxyFrame = needsCentre ? parseDensityVolumeFrame(await galaxyFrameValue()) : null;
const centreKpc = galaxyFrame ? galaxyFrame.originM.map(value => value / KPC_M) : null;
const hex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);

const unplaced: Record<string, number> = {}, kept: Record<string, number> = {};
const merged: { reference: number[]; colour: string; bank: string; group?: string }[] = [];
let bankFrame: ReturnType<typeof parseDensityVolumeFrame> | null = null, rawFrame: unknown = null;
for (const { bank: bankIdValue, withinPcOfCentre, keepEvery = 1 } of entries) {
  const bank = await readCatalogueBank(objectDirectory, bankIdValue) as { schema?: unknown; frame?: unknown; source?: unknown;
    appearance?: { colorCss?: unknown; opacity?: unknown; palette?: unknown; paletteTone?: unknown }; points?: unknown; kinematicSigmaKpc?: unknown; groups?: unknown };
  const parsedFrame = parseDensityVolumeFrame(bank?.frame), appearance = bank?.appearance;
  if (bank?.schema !== 'cssearth-catalogue-points@1' || !appearance || !hex(appearance.colorCss) || typeof appearance.opacity !== 'number' ||
      !(appearance.opacity > 0 && appearance.opacity <= 1) || !Array.isArray(bank.points)) throw new TypeError(`${bankIdValue}: not a catalogue point bank.`);
  // Sun-centred, unrotated banks in one frame and unit: kpc for a galaxy's disc, Mpc for the universe.
  const unit = cap?.mode === 'volume' ? MPC_M : needsCentre ? KPC_M : (bankFrame?.metersPerUnit ?? parsedFrame.metersPerUnit);
  const reference = bankFrame ?? galaxyFrame;
  if ((reference && (parsedFrame.referenceFrame !== reference.referenceFrame || parsedFrame.epochJdTt !== reference.epochJdTt)) || parsedFrame.metersPerUnit !== unit ||
      parsedFrame.originM.some(value => value !== 0) || parsedFrame.localToReferenceXyzw.some((value, index) => value !== [0, 0, 0, 1][index])) {
    throw new TypeError(`${bankIdValue}: only Sun-centred, unrotated banks in one reference frame, epoch and unit are merged (kpc with a galaxy's centre or disc cap, Mpc with a volume cap).`);
  }
  bankFrame ??= parsedFrame; rawFrame ??= bank.frame;
  const palette = appearance.palette === undefined ? null : appearance.palette;
  if (palette !== null && (!Array.isArray(palette) || !palette.every(hex))) throw new TypeError(`${bankIdValue}: the palette must be hex colours.`);
  const tones = appearance.paletteTone;
  if (tones !== undefined && (!Array.isArray(palette) || !Array.isArray(tones) || tones.length !== palette.length || !tones.every(value => typeof value === 'number' && value > 0 && value <= 1))) {
    throw new TypeError(`${bankIdValue}: paletteTone holds one tone in (0, 1] per palette colour.`);
  }
  const sigmas = bank.kinematicSigmaKpc;
  if (sigmas !== undefined && (!Array.isArray(sigmas) || sigmas.length !== bank.points.length || !sigmas.every(value => value === null || (typeof value === 'number' && value > 0)))) {
    throw new TypeError(`${bankIdValue}: kinematicSigmaKpc must be one positive number or null per point.`);
  }
  if (sigmas !== undefined && maxSigma === undefined) fail(`${bankIdValue} carries kinematic distance uncertainties; name maxKinematicSigmaKpc.`);
  const groups = bank.groups;
  if (groups !== undefined && (!Array.isArray(groups) || groups.length !== bank.points.length || !groups.every(value => typeof value === 'string'))) {
    throw new TypeError(`${bankIdValue}: groups must be one group name per point.`);
  }
  const layerTone = appearance.opacity;
  let near = 0;
  kept[bankIdValue] = 0;
  bank.points.forEach((point: unknown, index: number) => {
    if (!Array.isArray(point) || point.length !== (palette ? 4 : 3) || !point.every(Number.isFinite)) throw new TypeError(`${bankIdValue}: point ${index} is malformed.`);
    const sigma = sigmas ? (sigmas as (number | null)[])[index]! : null;
    if (sigma !== null && sigma > maxSigma!) { unplaced[bankIdValue] = (unplaced[bankIdValue] ?? 0) + 1; return; }
    const position = point.slice(0, 3) as number[];
    if (withinPcOfCentre !== undefined && Math.hypot(...position.map((value, axis) => value - centreKpc![axis]!)) * 1000 > withinPcOfCentre) return;
    if (near++ % keepEvery) return;
    const colour = palette ? palette[point[3] as number] : appearance.colorCss;
    if (!hex(colour)) throw new TypeError(`${bankIdValue}: point ${index} names palette colour ${point[3]}, which the palette of ${palette!.length} lacks.`);
    const tone = (tones ? (tones as number[])[point[3] as number]! : 1) * layerTone;
    const group = groups ? (groups as string[])[index]! : '';
    merged.push({ reference: position, colour: toned(graded(colour), tone), bank: bankIdValue, ...(group ? { group: `${bankIdValue}:${group}` } : {}) }); kept[bankIdValue]!++;
  });
}
const hash = (index: number) => ((index + 1) * 2654435761) % 4294967296;
const shuffled = merged.map((point, index) => ({ point, key: hash(index) })).sort((a, b) => a.key - b.key).map(({ point }) => point);
const capped: Record<string, number> = {};
// The enclosing levels' dots are already drawn: a dot at one of their positions is theirs, and under a cap they count
// toward it.
const enclosing = new Set<string>(), enclosingPoints: number[][] = [];
for (const level of (recipe.within ?? []) as string[]) {
  const outer = await readCatalogueBank(objectDirectory, level) as { schema?: unknown; frame?: unknown; points?: unknown };
  const outerFrame = parseDensityVolumeFrame(outer.frame);
  if (outer.schema !== 'cssearth-catalogue-points@1' || !Array.isArray(outer.points) || outerFrame.metersPerUnit !== bankFrame!.metersPerUnit ||
      outerFrame.referenceFrame !== bankFrame!.referenceFrame || outerFrame.originM.some(value => value !== 0)) {
    throw new TypeError(`${level}: an enclosing level must be a merged bank in this level's frame and unit.`);
  }
  for (const point of outer.points as number[][]) { enclosing.add(point.slice(0, 3).join(',')); enclosingPoints.push(point.slice(0, 3)); }
}
const drawnOutside: Record<string, number> = {};
let ordered = shuffled.filter(point => {
  if (!enclosing.has(point.reference.join(','))) return true;
  drawnOutside[point.bank] = (drawnOutside[point.bank] ?? 0) + 1; kept[point.bank]!--; return false;
});
if (recipe.within) console.log(`Already drawn by ${(recipe.within as string[]).join(', ')}: ${JSON.stringify(drawnOutside)}.`);
if (cap?.mode === 'volume' && cap.shell !== undefined) {
  // Per shell around the Sun: the cap's count for the shell's volume, less the enclosing levels' dots in it, kept in the
  // fixed shuffle, so the share kept is random within the shell and its clusters keep their contrast.
  const width = cap.shell, shellOf = (position: readonly number[]) => Math.floor(Math.hypot(...position) / width);
  const drawn = new Map<number, number>();
  for (const point of enclosingPoints) drawn.set(shellOf(point), (drawn.get(shellOf(point)) ?? 0) + 1);
  const roomOf = (shell: number) => {
    const middle = (shell + 0.5) * width;
    const taper = cap.taper ? Math.max(0, Math.min(1, (cap.taper[1] - middle) / (cap.taper[1] - cap.taper[0]))) : 1;
    return cap.perMpc3 * 4 / 3 * Math.PI * (((shell + 1) * width) ** 3 - (shell * width) ** 3) * taper - (drawn.get(shell) ?? 0);
  };
  const selected = new Set(selectByShell(ordered, width, roomOf, cap.groupsFirst));
  ordered = ordered.filter(point => {
    if (selected.has(point)) return true;
    capped[point.bank] = (capped[point.bank] ?? 0) + 1; kept[point.bank]!--; return false;
  });
} else if (cap) {
  // The space the cap counts in: face-on Galactic x (toward the centre) and y (toward l = 90°) from the Hipparcos
  // rotation for a disc, or the banks' own 3D coordinates for the universe.
  const axes = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132], [0.4941094278755837, -0.4448296299600112, 0.7469822444972189]];
  const place = (position: readonly number[]) => cap.mode === 'disc' ? axes.map(axis => axis.reduce((sum, value, k) => sum + value * position[k]!, 0)) : [...position];
  const centre = cap.mode === 'disc' ? place(centreKpc!) : null, sunRadius = centre ? Math.hypot(...centre) : 0;
  const kernelMeasure = cap.mode === 'disc' ? Math.PI * cap.kernel ** 2 : 4 / 3 * Math.PI * cap.kernel ** 3;
  const law = (position: readonly number[]) => cap.mode === 'disc'
    ? cap.atSunPerKpc2 * Math.exp(-(Math.hypot(...position.map((value, axis) => value - centre![axis]!)) - sunRadius) / cap.scaleLengthKpc) : cap.perMpc3;
  const cells = new Map<string, number[][]>(), cellOf = (position: readonly number[]) => position.map(value => Math.floor(value / cap.kernel));
  const offsets = cap.mode === 'disc' ? [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => [i, j]))
    : [-1, 0, 1].flatMap(i => [-1, 0, 1].flatMap(j => [-1, 0, 1].map(k => [i, j, k])));
  for (const point of enclosingPoints) {
    const position = place(point), key = cellOf(position).join(','), list = cells.get(key);
    if (list) list.push(position); else cells.set(key, [position]);
  }
  ordered = ordered.filter(point => {
    const position = place(point.reference), fromSun = Math.hypot(...position);
    const taper = cap.taper ? Math.max(0, Math.min(1, (cap.taper[1] - fromSun) / (cap.taper[1] - cap.taper[0]))) : 1;
    const allowed = law(position) * kernelMeasure * taper, home = cellOf(position);
    let near = 0;
    for (const offset of offsets) {
      for (const other of cells.get(home.map((value, axis) => value + offset[axis]!).join(',')) ?? []) {
        if (Math.hypot(...other.map((value, axis) => value - position[axis]!)) < cap.kernel) near++;
      }
    }
    if (near >= allowed) { capped[point.bank] = (capped[point.bank] ?? 0) + 1; kept[point.bank]!--; return false; }
    const key = home.join(','), list = cells.get(key);
    if (list) list.push(position); else cells.set(key, [position]);
    return true;
  });
}
const palette = [...new Set(ordered.map(point => point.colour))], paletteIndex = new Map(palette.map((colour, index) => [colour, index]));
// Around the galaxy's centre: its frame origin, the Sun-centred frame's axes and unit, bounds reaching the farthest dot.
const written = centreOnGalaxy ? ordered.map(point => point.reference.map((value, axis) => Math.round((value - centreKpc![axis]!) * 1e4) / 1e4)) : ordered.map(point => point.reference);
const reach = Math.ceil(Math.max(...written.map(point => Math.hypot(...point))));
const outputFrame = centreOnGalaxy ? { ...(rawFrame as object), originM: galaxyFrame!.originM, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } } : rawFrame;
const output = { schema: 'cssearth-catalogue-points@1', id, source: 'merge', meaning: recipe.meaning,
  order: 'A fixed shuffle, so a thinned prefix thins every region alike.', banks: entries.map(value => ({ ...value, kept: kept[value.bank] })),
  ...(recipe.within ? { within: recipe.within } : {}),
  ...(maxSigma === undefined ? {} : { unplaced: { maxKinematicSigmaKpc: maxSigma, basis: recipe.maxKinematicSigmaBasis, left: unplaced } }),
  ...(cap ? { densityCap: { ...recipe.densityCap as object, left: capped } } : {}),
  frame: outputFrame, appearance: { colorCss: '#ffffff', radiusPx: 0.75, opacity: 1, palette },
  counts: { points: ordered.length }, points: ordered.map((point, index) => [...written[index]!, paletteIndex.get(point.colour)!]) };
// A merged bank is published only when its recipe says the app fetches it; a level of a later stack is a bake input.
await writeCatalogueBank({ objectDirectory, id, bank: output, published: recipePublished(recipe, recipePath) });
console.log(`Merged ${ordered.length} dots: kept ${JSON.stringify(kept)}; left out as unplaced ${JSON.stringify(unplaced)}; over the density cap ${JSON.stringify(capped)}.`);
