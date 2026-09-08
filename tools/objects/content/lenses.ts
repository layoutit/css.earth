import { prepareLensCategoryLegend, prepareLensScaleLegend } from "../../../site/prepared-lens-legends.mjs";
import { LensRecipe, PreparedRasterAssets } from "./types";

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

export function prepareLenses(
  objectId: string,
  recipe: { title: { label: string; src: string; width: number; height: number }; defaultLens: string; controls: LensRecipe[] },
  assets: PreparedRasterAssets = {},
) {
  if (recipe.controls.length && !recipe.controls.some((control) => control.id === recipe.defaultLens)) {
    throw new Error(`${objectId}: default lens ${recipe.defaultLens} is not declared`);
  }
  return {
    title: recipe.title,
    defaultLens: recipe.defaultLens,
    controls: recipe.controls.map((control) => {
      const surface = assets.surfaces?.[control.id];
      const material = assets.materials?.[control.material ?? control.id];
      const poles = assets.poles;
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
        ...(control.detail ? { detail: control.detail } : {}),
        ...(control.shortLabel ? { shortLabel: control.shortLabel } : {}),
        ...(control.falseColor !== undefined ? { falseColor: control.falseColor } : {}),
        ...(control.filter ? { filter: control.filter } : {}),
        ...(control.qualification ? { qualification: control.qualification } : {}),
        ...(control.view ? { view: control.view } : {}),
        thumbnailUrl: assetUrl(objectId, control.thumbnail),
        description: control.description,
        ...(facts?.length ? { facts } : {}),
        title: control.title,
        ...(legend ? { legend } : {}),
        ...(control.legendNote ? { legendNote: control.legendNote } : {}),
        surfaceUrl: surface?.url ?? assetUrl(objectId, control.surface),
        surface2xUrl: surface?.url2x ?? assetUrl(objectId, control.surface?.replace(/\.webp$/u, "@2x.webp")),
        polesUrl: surface?.polesUrl ?? poles?.url ?? assetUrl(objectId, control.poles),
        poles2xUrl: surface?.polesUrl2x ?? poles?.url2x ?? assetUrl(objectId, control.poles?.replace(/(?:@2x)?\.webp$/u, "@2x.webp")),
        materialUrl: material?.url ?? assetUrl(objectId, control.material),
        material2xUrl: material?.url2x ?? assetUrl(objectId, control.material?.replace(/\.webp$/u, "@2x.webp")),
        source: control.source,
      };
    }),
  };
}
