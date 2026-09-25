import { prepareLensCategoryLegend, prepareLensScaleLegend } from "../../../site/prepared-lens-legends.mts";
import type { LensRecipe, PreparedRasterAssets } from "./types";

const assetUrl = (objectId: string, asset: string | undefined): string | undefined => {
  if (!asset) return undefined;
  return asset.startsWith("/") ? asset : `/scenes/${objectId}/${asset}`;
};

function prepareLegend(objectId: string, legend: LensRecipe["legend"]) {
  if (!legend) return undefined;
  if (legend.kind === "ranges") {
    if (!legend.ranges?.length || legend.ranges.some(range =>
      !range.label || !range.color || !Number.isFinite(range.low))) {
      throw new TypeError("A range legend requires labeled finite ranges.");
    }
    return legend.ranges;
  }
  if (legend.kind === "scale" && legend.recipe) {
    const prepared = prepareLensScaleLegend({
      title: legend.title,
      palette: legend.recipe.palette,
      labels: legend.recipe.labels,
      meta: legend.meta,
      sourceUrl: legend.sourceUrl,
    });
    return {
      ...prepared,
      ...(legend.image ? { src: assetUrl(objectId, legend.image) } : {}),
      ...(legend.width !== undefined ? { width: legend.width } : {}),
      ...(legend.height !== undefined ? { height: legend.height } : {}),
    };
  }
  if (legend.kind === "scale") {
    return {
      kind: "scale" as const,
      title: legend.title,
      meta: legend.meta,
      src: assetUrl(objectId, legend.image),
      width: legend.width,
      height: legend.height,
      labels: legend.labels,
      sourceUrl: legend.sourceUrl,
    };
  }
  return prepareLensCategoryLegend({
    title: legend.title,
    items: legend.items ?? [],
    meta: legend.meta,
    sourceUrl: legend.sourceUrl,
  });
}

/** Stepped lenses form groups of at least two consecutive members with distinct step labels; a group is never a lens id. */
export function validateLensSteps(objectId: string, controls: readonly { id: string; step?: { group: string; label: string } }[]) {
  const seen = new Set<string>();
  controls.forEach((control, index) => {
    const step = control.step;
    if (step === undefined) return;
    if (typeof step.group !== "string" || !/^[a-z][a-z0-9-]*$/u.test(step.group) || typeof step.label !== "string" || !step.label.trim()) {
      throw new TypeError(`${objectId}/${control.id}: a lens step needs a group id and a label`);
    }
    if (controls.some(other => other.id === step.group)) throw new TypeError(`${objectId}: step group ${step.group} must not be a lens id`);
    if (controls[index - 1]?.step?.group !== step.group) {
      if (seen.has(step.group)) throw new TypeError(`${objectId}: the steps of ${step.group} must be consecutive`);
      seen.add(step.group);
    }
  });
  for (const group of seen) {
    const members = controls.filter(control => control.step?.group === group);
    if (members.length < 2) throw new TypeError(`${objectId}: step group ${group} needs at least two steps`);
    if (new Set(members.map(member => member.step!.label)).size !== members.length) throw new TypeError(`${objectId}: the steps of ${group} need distinct labels`);
  }
}

export function prepareLenses(
  objectId: string,
  recipe: { title: { label: string; src: string; width: number; height: number }; defaultLens: string; controls: LensRecipe[] },
  assets: PreparedRasterAssets = {},
) {
  if (recipe.controls.length && !recipe.controls.some((control) => control.id === recipe.defaultLens)) {
    throw new Error(`${objectId}: default lens ${recipe.defaultLens} is not declared`);
  }
  validateLensSteps(objectId, recipe.controls);
  return {
    title: recipe.title,
    defaultLens: recipe.defaultLens,
    controls: recipe.controls.map((control) => {
      const surface = assets.surfaces?.[control.id];
      const material = assets.materials?.[control.material ?? control.id];
      const legend = prepareLegend(objectId, control.legend);
      if (control.facts !== undefined && (!Array.isArray(control.facts) ||
          control.facts.some(fact => !fact || [fact.id, fact.label, fact.value].some(value =>
            typeof value !== "string" || !value.trim())) ||
          new Set(control.facts.map(fact => fact.id)).size !== control.facts.length)) {
        throw new TypeError(`${objectId}/${control.id}: lens facts require unique ids and nonempty labels and values`);
      }
      const facts = control.facts?.map(({ id, label, value }) => ({ id, label, value }));
      return {
        id: control.id,
        label: control.label,
        ...(control.shortLabel ? { shortLabel: control.shortLabel } : {}),
        ...(control.falseColor !== undefined ? { falseColor: control.falseColor } : {}),
        ...(control.filter ? { filter: control.filter } : {}),
        ...(control.qualification ? { qualification: control.qualification } : {}),
        ...(control.view ? { view: control.view } : {}),
        thumbnailUrl: assetUrl(objectId, control.thumbnail),
        // A dataset that names a companion cloud borrows another lens's prepared surface; the shell drives the cloud.
        ...(control.volume ? { volume: control.volume } : {}),
        ...(control.noData ? { noData: true } : {}),
        ...(facts?.length ? { facts } : {}),
        ...(legend ? { legend } : {}),
        ...(control.legendNote ? { legendNote: control.legendNote } : {}),
        ...(control.step ? { step: { group: control.step.group, label: control.step.label } } : {}),
        surfaceUrl: surface?.url ?? assetUrl(objectId, control.surface),
        surface2xUrl: surface?.url2x ?? assetUrl(objectId, control.surface?.replace(/(?:@2x)?\.webp$/u, "@2x.webp")),
        polesUrl: surface?.polesUrl ?? assetUrl(objectId, control.poles),
        poles2xUrl: surface?.polesUrl2x ?? assetUrl(objectId, control.poles?.replace(/(?:@2x)?\.webp$/u, "@2x.webp")),
        materialUrl: material?.url ?? assetUrl(objectId, control.material),
        material2xUrl: material?.url2x ?? assetUrl(objectId, control.material?.replace(/(?:@2x)?\.webp$/u, "@2x.webp")),
        // Emissive bodies: the prepared off-limb context and limb plate keep the lens resource keys corona:/limb:.
        ...(surface?.coronaUrl ? { coronaUrl: surface.coronaUrl, corona2xUrl: surface.coronaUrl2x } : {}),
        ...(surface?.limbUrl ? { limbUrl: surface.limbUrl, limb2xUrl: surface.limbUrl2x } : {}),
        source: control.source,
      };
    }),
  };
}
