import { readChartAssetRecipe } from '@cssearth/objects';
// Shared object-content preparation. Source JSON owns facts, labels, recipes,
// and provenance; this module owns the derived shell payload.

import { PREPARED_CONTENT_SCHEMA, validateObjectContentEnvelope, type ObjectContentSource, type PreparedObjectContent, type PreparedObjectContentDocument, type GalleryRecipe } from '@cssearth/objects';
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PREPARED_SHELL_TITLES } from "../../prepared-shell-titles.mjs";
import { datasetBillboardColors, prepareDatasetLabels, prepareDatasets } from "@cssearth/bake/objects/content";
import { parseFactsheet, verifyFactsheetSources } from '@cssearth/bake/sources';
import type { ContentPreparationContext, PreparedObjectContentAssets, PreparedRasterAssets } from '@cssearth/bake/objects/content';

const titleMap: Record<string, { label: string; src: string; width: number; height: number }> = {
  facts: PREPARED_SHELL_TITLES.facts,
  reflectance: PREPARED_SHELL_TITLES.reflectance,
  temperaturePressure: PREPARED_SHELL_TITLES.temperaturePressure,
  surfacePhotos: PREPARED_SHELL_TITLES.surfacePhotos,
  telescopeImages: PREPARED_SHELL_TITLES.telescopeImages,
  resources: PREPARED_SHELL_TITLES.resources,
  datasets: PREPARED_SHELL_TITLES.datasets,
  settings: PREPARED_SHELL_TITLES.settings,
};

const SCIENTIFIC_CHART_TITLES = Object.freeze({
  reflectance: PREPARED_SHELL_TITLES.reflectance,
  photometricPhase: Object.freeze({ label: "Photometric phase curve" }),
  temperaturePressure: PREPARED_SHELL_TITLES.temperaturePressure,
  reflectedLight: Object.freeze({ label: "Reflected light" }),
  broadbandAlbedo: Object.freeze({ label: "Broadband albedo" }),
  transmissionSpectrum: Object.freeze({ label: "Transmission spectrum" }),
  emissionSpectrum: Object.freeze({ label: "Dayside emission" }),
  systemOrbits: Object.freeze({ label: "Orbits" }),
  transitLightCurve: Object.freeze({ label: "Transit" }),
});

/** The display fields of a shell title. Its font pin and input hash are the generator's receipt and stay in its own module. */
function requiredShellTitle(key: string): { label: string; src: string; width: number; height: number } {
  const title = titleMap[key];
  if (!title) throw new Error(`Unknown shared shell title key: ${key}`);
  return { label: title.label, src: title.src, width: title.width, height: title.height };
}

function requiredChartTitle(key: string) {
  const titles: Readonly<Record<string, { readonly label: string }>> = SCIENTIFIC_CHART_TITLES;
  const title = titles[key] ?? titleMap[key];
  if (!title) throw new Error(`Unknown shared chart title key: ${key}`);
  return { label: title.label };
}

export function prepareObjectContent(
  source: ObjectContentSource,
  assets: PreparedRasterAssets = {},
): PreparedObjectContent {
  validateObjectContentEnvelope(source);
  // The page sets the display name in the shared title font; no object carries its own title artwork.
  const title = { label: source.displayName };
  const { facts, moreFacts } = parseFactsheet(source.panel);
  const datasetControls = source.datasets.labels
    ? prepareDatasetLabels({ controls: source.datasets.controls }, source.datasets.labels).controls
    : source.datasets.controls;
  return {
    objectId: source.id,
    title,
    facts,
    moreFacts,
    datasets: prepareDatasets(source.id, {
      title: requiredShellTitle(source.datasets.titleKey),
      defaultDataset: source.datasets.defaultDataset,
      controls: datasetControls,
    }, assets),
    settings: {
      title: requiredShellTitle(source.settings.titleKey),
      controls: source.settings.controls,
    },
    charts: source.charts.map((chart) => ({
      ...chart,
      title: requiredChartTitle(chart.titleKey),
    })),
    galleries: (source.galleries ?? []).map((gallery) => ({
      ...gallery,
      title: requiredShellTitle(gallery.titleKey),
    })),
    resources: source.resources,
  };
}

export async function prepareObjectContentAssets({
  sourceDirectory,
  publicDirectory,
  outputDirectory,
  config,
}: ContentPreparationContext): Promise<PreparedObjectContentAssets> {
  for (const directory of [sourceDirectory, publicDirectory, outputDirectory]) {
    if (typeof directory !== "string" || directory.length === 0) {
      throw new TypeError("Object content preparation requires directory paths.");
    }
  }
  const sourcePath = resolve(sourceDirectory, config.contentPath ?? "content/object.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as ObjectContentSource;
  validateObjectContentEnvelope(source);
  const objectDirectory = resolve(sourceDirectory, '..');
  await verifyFactsheetSources(source.panel, { objectDirectory });
  await prepareRasterLegendAssets(source, sourceDirectory, publicDirectory);
  let assets: PreparedRasterAssets = {};
  try {
    assets = JSON.parse(await readFile(resolve(outputDirectory, config.assetsPath ?? "assets.json"), "utf8")) as PreparedRasterAssets;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let chartAssets: {
    urls: string[];
    dimensions: { src: string; width: number; height: number }[];
    gallery?: { items: GalleryRecipe["items"]; qualification?: string };
  } | undefined;
  let chartConfig: unknown;
  try {
    const chartsPath = resolve(sourceDirectory, config.chartsPath ?? "content/charts.json");
    chartConfig = readChartAssetRecipe(JSON.parse(await readFile(chartsPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (chartConfig !== undefined) {
    const { prepareChartAssets } = await import("../charts/charts.ts");
    chartAssets = await prepareChartAssets({ sourceDirectory, publicDirectory, config: chartConfig }) as {
      urls: string[];
      dimensions: { src: string; width: number; height: number }[];
      gallery?: { items: GalleryRecipe["items"]; qualification?: string };
    };
  }
  const prepared = prepareObjectContent(source, assets);
  const datasets = await deriveDatasetBillboardColors(prepared.datasets, publicDirectory);
  const preparedWithAssets = { ...prepared, datasets };
  const content: PreparedObjectContentDocument = {
    schema: PREPARED_CONTENT_SCHEMA,
    objectId: preparedWithAssets.objectId,
    title: preparedWithAssets.title,
    facts: preparedWithAssets.facts,
    moreFacts: preparedWithAssets.moreFacts,
    charts: preparedWithAssets.charts.map(chart => ({ ...chart,
      ...chartAssets?.dimensions.find(image => image.src === chart.src),
    })),
    galleries: preparedWithAssets.galleries.map((gallery, index) => ({
      ...gallery,
      ...(chartAssets?.gallery && index === 0 ? {
        qualification: chartAssets.gallery.qualification ?? gallery.qualification,
        items: chartAssets.gallery.items,
      } : {}),
    })),
    resources: preparedWithAssets.resources,
    provenance: source.provenance,
  };
  if (chartAssets && content.charts.some((chart) => !chartAssets?.urls.includes(chart.src))) {
    throw new Error(`${source.id}: generated chart assets do not match authored chart URLs`);
  }
  const datasetsDocument = { schema: "cssearth-prepared-datasets@1", objectId: preparedWithAssets.objectId, ...preparedWithAssets.datasets };
  const shellDatasets = {
    title: preparedWithAssets.datasets.title,
    defaultDataset: preparedWithAssets.datasets.defaultDataset,
    controls: preparedWithAssets.datasets.controls.map(({ id, label, thumbnailUrl, noData, facts, legend, legendNote, volume, step }) => ({
      id,
      label,
      thumbnailUrl,
      ...(volume ? { volume } : {}),
      ...(step ? { step } : {}),
      ...(noData === true ? { noData } : {}),
      ...(facts?.length ? { facts } : {}),
      ...(legend ? { legend } : {}),
      ...(legendNote ? { legendNote } : {}),
    })),
  };
  const controls = {
    datasets: shellDatasets.controls.length ? shellDatasets : null,
    settings: preparedWithAssets.settings,
  };
  await mkdir(publicDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "content.json"), `${JSON.stringify(content)}\n`),
    writeFile(resolve(outputDirectory, "datasets.json"), `${JSON.stringify(datasetsDocument)}\n`),
    writeFile(resolve(outputDirectory, "controls.json"), `${JSON.stringify(controls)}\n`),
  ]);
  return {
    id: preparedWithAssets.objectId,
    content,
    datasets: preparedWithAssets.datasets,
    controls,
    files: ["content.json", "datasets.json", "controls.json"],
  };
}

async function prepareRasterLegendAssets(
  source: ObjectContentSource,
  sourceDirectory: string,
  publicDirectory: string,
): Promise<void> {
  const sharp = (await import("sharp")).default;
  for (const control of source.datasets.controls) {
    const legend = control.legend;
    if (!legend?.sourcePath || !legend.image || !legend.rasterRecipe) continue;
    const recipe = legend.rasterRecipe;
    const image = await sharp(resolve(sourceDirectory, legend.sourcePath))
      .extract(recipe.crop)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const divider = recipe.dividerRows;
    if (divider) {
      const dividerRows: number[] = [];
      for (let y = 0; y < image.info.height; y += 1) {
        let darkPixels = 0;
        for (let x = 0; x < image.info.width; x += 1) {
          const offset = (y * image.info.width + x) * image.info.channels;
          if (image.data[offset] <= divider.threshold &&
              image.data[offset + 1] <= divider.threshold &&
              image.data[offset + 2] <= divider.threshold) darkPixels += 1;
        }
        if (darkPixels / image.info.width >= divider.minimumCoverage) dividerRows.push(y);
      }
      const runs: Array<{ start: number; end: number }> = [];
      for (const row of dividerRows) {
        const previous = runs.at(-1);
        if (previous && row === previous.end + 1) previous.end = row;
        else runs.push({ start: row, end: row });
      }
      if (runs.length !== divider.expectedRuns) {
        throw new Error(`${source.id}: expected ${divider.expectedRuns} legend divider runs, found ${runs.length}`);
      }
      const rowBytes = image.info.width * image.info.channels;
      for (const run of runs) {
        const midpoint = (run.start + run.end) / 2;
        for (let row = run.start; row <= run.end; row += 1) {
          const sourceRow = row <= midpoint ? run.start - 1 : run.end + 1;
          image.data.copy(image.data, row * rowBytes, sourceRow * rowBytes, (sourceRow + 1) * rowBytes);
        }
      }
    }
    await mkdir(publicDirectory, { recursive: true });
    await sharp(image.data, { raw: image.info })
      .rotate(90)
      .resize({ width: recipe.outputWidth, height: recipe.outputHeight, fit: "fill", kernel: "nearest" })
      .webp({ lossless: true })
      .toFile(resolve(publicDirectory, basename(legend.image)));
  }
}

async function deriveDatasetBillboardColors(
  datasets: PreparedObjectContent["datasets"],
  publicDirectory: string,
): Promise<PreparedObjectContent["datasets"]> {
  const colors = await datasetBillboardColors(datasets.controls, datasets.defaultDataset, publicDirectory);
  return {
    ...datasets,
    controls: datasets.controls.map((control) => ({
      ...control,
      billboardColor: colors.get(typeof control.id === "string" ? control.id : "") ??
        (control.view === "interior" ? colors.get(datasets.defaultDataset) : undefined),
    })),
  };
}
