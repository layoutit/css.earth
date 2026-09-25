import type { CompilerImage } from '../observations/compiler-image.ts';
import type { EmissionFieldModel, CompilerStarInput, CompilerStarMaterial } from '@cssearth/bake/volume';
import { readCompilerStarCatalogue, type CompilerStarCatalogue } from './catalogue-model.ts';
import { compilerStarLensPoints, createCompilerStarDepthSampler, createCompilerStarPhotometer, detectCompilerStarCandidates } from './compiler.ts';
type Point = [number, number];
interface Candidate { id: string; sourceId: string; nativePoint: Point; sky: Point; detectedIn: string[] }
/** Ordered sources preserve the first measured position; nearby observations never average or move it. */
export async function compilerUnionStars(reference: CompilerImage, model: EmissionFieldModel, maximum: number,
  lenses: readonly CompilerImage[], settings: CompilerStarCatalogue) {
  const configuration = readCompilerStarCatalogue(settings), ids = lenses.map(lens => lens.id);
  if (new Set(ids).size !== ids.length || configuration.sourceIds[0] !== reference.id || configuration.sourceIds.some(id => !ids.includes(id)))
    throw new TypeError('Compiler star catalogue references an unavailable or invalid anchor image.');
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > 2000) throw new TypeError('Invalid shared star budget.');
  const sources = configuration.sourceIds.map(id => lenses.find(lens => lens.id === id)!), candidates: Candidate[] = [];
  const cells = new Map<string, number[]>(), radius = configuration.mergeRadiusArcsec;
  const cellKey = (x: number, y: number) => `${x},${y}`;
  const detectionCounts: Record<string, number> = {};
  for (const source of sources) {
    const detected = await detectCompilerStarCandidates(source); detectionCounts[source.id] = detected.length;
    detected.forEach((star, index) => {
      const sky = source.pixelToSky(...star.point), cx = Math.floor(sky[0] / radius), cy = Math.floor(sky[1] / radius);
      let nearest = -1, distance = radius;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        for (const candidateIndex of cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
          const candidate = candidates[candidateIndex]!;
          // Separate same-image maxima remain separate; this joins registered observations across sources.
          if (candidate.sourceId === source.id || candidate.detectedIn.includes(source.id)) continue;
          const separation = Math.hypot(sky[0] - candidate.sky[0], sky[1] - candidate.sky[1]);
          if (separation <= distance) { distance = separation; nearest = candidateIndex; }
        }
      if (nearest >= 0) { candidates[nearest]!.detectedIn.push(source.id); return; }
      const key = cellKey(cx, cy); if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(candidates.length);
      candidates.push({ id: `${source.id}-${index}`, sourceId: source.id, nativePoint: star.point, sky, detectedIn: [source.id] });
    });
  }
  const nativePoints = candidates.map(candidate => compilerStarLensPoints(sources.find(source => source.id === candidate.sourceId)!, reference, [candidate.nativePoint])[0]!);
  const measured = lenses.map(lens => {
    const photometer = createCompilerStarPhotometer(lens, compilerStarLensPoints(reference, lens, nativePoints));
    return { id: lens.id, values: candidates.map((_, index) => photometer.measure(index)) };
  });
  const normalizations = sources.map(source => {
    const values = measured.find(lens => lens.id === source.id)!.values;
    const energies = values.flatMap(value => value ? [Math.max(...value.measurement.residualDisplayEnergyRgb)] : []).sort((a, b) => a - b);
    return { id: source.id, energyScale: energies[Math.min(energies.length - 1, Math.floor(energies.length * .99))] ?? 0, positiveApertures: energies.length };
  });
  const ranked = candidates.map((candidate, index) => ({ candidate, index, score: Math.max(...normalizations.map(normalization => {
    const value = measured.find(lens => lens.id === normalization.id)!.values[index];
    return value && normalization.energyScale > 0 ? Math.max(...value.measurement.residualDisplayEnergyRgb) / normalization.energyScale : 0;
  })) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const depth = createCompilerStarDepthSampler(model), stars: CompilerStarInput[] = [], selected: { id: string; anchorSource: string; nativePoint: Point; detectedIn: string[]; selectionScore: number }[] = [];
  for (const { candidate, index, score } of ranked) {
    if (stars.length >= maximum) break;
    const z = depth(candidate.id, ...candidate.sky); if (z === null) continue;
    const anchor = measured.find(lens => lens.id === candidate.sourceId)!.values[index];
    if (!anchor) continue;
    const materials: Record<string, CompilerStarMaterial> = {};
    for (const lens of measured) {
      const value = lens.values[index];
      materials[lens.id] = value ? { rgb: value.rgb, alpha: value.alpha, diameterUnits: value.diameterUnits } :
        { rgb: [0, 0, 0], alpha: 0, diameterUnits: anchor.diameterUnits };
    }
    stars.push({ id: candidate.id, positionArcsec: [...candidate.sky, z], rgb: anchor.rgb, alpha: anchor.alpha, diameterUnits: anchor.diameterUnits, materials });
    selected.push({ id: candidate.id, anchorSource: candidate.sourceId, nativePoint: candidate.nativePoint, detectedIn: candidate.detectedIn, selectionScore: score });
  }
  return { stars, selection: { method: 'registered-residual-union@1', configuration, detectionCounts, mergedCandidates: candidates.length,
    sourceEnergyNormalizations: normalizations, selected,
    interpretation: 'Observed residual maxima merged only across registered sources. Source order retains anchor astrometry within the explicit angular tolerance. Selection uses maximum aperture energy divided by each source 99th-percentile positive aperture energy; this display exposure normalization changes ranking only, never emitted brightness. Per-lens measured encoded RGB energy and conditional field depth remain uncalibrated and do not establish membership or distance.' } };
}
