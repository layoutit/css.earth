// Shared object-content preparation. Source JSON owns facts, labels, recipes,
// and provenance; this module owns the derived shell payload.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { PREPARED_SHELL_TITLES } from "../../../site/prepared-shell-titles.mjs";
import { prepareLensLabels } from "../../../site/prepare-lens-labels.mts";
import { SCIENTIFIC_CHART_TITLES } from "../../../site/scientific-chart-titles.mts";
import { createPreparedTitleLayout } from "../../../src/platform/prepared-title.mts";
import { prepareLenses } from "./lenses";
import { lensBillboardColors } from "./billboard-colors.mts";
import { parseFactsheet, verifyFactsheetSources } from '../../sources/factsheet-sources.mts';
import type {
  ContentPreparationContext,
  ObjectContentSource,
  PreparedObjectContent,
  PreparedObjectContentAssets,
  PreparedObjectContentDocument,
  PreparedRasterAssets,
  GalleryRecipe,
} from "./types";

const titleMap: Record<string, { label: string; src: string; width: number; height: number }> = {
  facts: PREPARED_SHELL_TITLES.facts,
  reflectance: PREPARED_SHELL_TITLES.reflectance,
  temperaturePressure: PREPARED_SHELL_TITLES.temperaturePressure,
  surfacePhotos: PREPARED_SHELL_TITLES.surfacePhotos,
  telescopeImages: PREPARED_SHELL_TITLES.telescopeImages,
  resources: PREPARED_SHELL_TITLES.resources,
  lenses: PREPARED_SHELL_TITLES.lenses,
  settings: PREPARED_SHELL_TITLES.settings,
};

/** The display fields of a shell title. Its font pin and input hash are the generator's receipt and stay in its own module. */
function requiredShellTitle(key: string): { label: string; src: string; width: number; height: number } {
  const title = titleMap[key];
  if (!title) throw new Error(`Unknown shared shell title key: ${key}`);
  return { label: title.label, src: title.src, width: title.width, height: title.height };
}

function requiredChartTitle(key: string) {
  const title = key === "photometricPhase"
    ? SCIENTIFIC_CHART_TITLES.photometricPhase
    : titleMap[key];
  if (!title) throw new Error(`Unknown shared chart title key: ${key}`);
  return { label: title.label };
}

export function prepareObjectContent(
  source: ObjectContentSource,
  assets: PreparedRasterAssets = {},
): PreparedObjectContent {
  if (source.schema !== "cssearth-object-content@1" || source.version !== 1) {
    throw new Error(`${source.id}: unsupported object content schema`);
  }
  if (source.title.label !== source.displayName) {
    throw new Error(`${source.id}: title label does not match display name`);
  }
  // The prepared title carries what the page draws: the glyph path, its boxes and the font's name. The font pin and
  // the generator note stay in the object's title-mark source, whose bytes git records.
  const { sourceGenerator: _generator, xOrigin: _origin, ...titleSource } = source.title;
  const title = {
    ...titleSource,
    ...createPreparedTitleLayout(source.title),
  } as PreparedObjectContent["title"];
  const { facts, moreFacts } = parseFactsheet(source.panel);
  const lensControls = source.lenses.labels
    ? prepareLensLabels({ controls: source.lenses.controls }, source.lenses.labels).controls
    : source.lenses.controls;
  return {
    objectId: source.id,
    title,
    facts,
    moreFacts,
    lenses: prepareLenses(source.id, {
      title: requiredShellTitle(source.lenses.titleKey),
      defaultLens: source.lenses.defaultLens,
      controls: lensControls,
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
  const objectDirectory = resolve(sourceDirectory, '..');
  await verifyFactsheetSources(source.panel, { objectDirectory });
  const titleSourcePath = source.provenance.title?.path;
  let preparedSource = source;
  if (titleSourcePath?.endsWith(".json")) {
    const parsedTitle = JSON.parse(await readFile(resolve(dirname(sourcePath), titleSourcePath), "utf8")) as ObjectContentSource["title"] & { schema?: string };
    const { schema: _schema, ...title } = parsedTitle;
    preparedSource = { ...source, title };
  }
  await prepareRasterLegendAssets(preparedSource, sourceDirectory, publicDirectory);
  let assets: PreparedRasterAssets = {};
  try {
    assets = JSON.parse(await readFile(resolve(outputDirectory, config.assetsPath ?? "assets.json"), "utf8")) as PreparedRasterAssets;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let chartAssets: {
    urls: string[];
    gallery?: { items: GalleryRecipe["items"]; qualification?: string };
  } | undefined;
  let chartConfig: unknown;
  try {
    const chartsPath = resolve(sourceDirectory, config.chartsPath ?? "content/charts.json");
    chartConfig = JSON.parse(await readFile(chartsPath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (chartConfig !== undefined) {
    const { prepareChartAssets } = await import("./charts");
    chartAssets = await prepareChartAssets({ sourceDirectory, publicDirectory, config: chartConfig }) as {
      urls: string[];
      gallery?: { items: GalleryRecipe["items"]; qualification?: string };
    };
  }
  const prepared = prepareObjectContent(preparedSource, assets);
  const lenses = await deriveLensBillboardColors(prepared.lenses, publicDirectory);
  const preparedWithAssets = { ...prepared, lenses };
  const content: PreparedObjectContentDocument = {
    schema: "cssearth-prepared-content@1",
    objectId: preparedWithAssets.objectId,
    title: preparedWithAssets.title,
    facts: preparedWithAssets.facts,
    moreFacts: preparedWithAssets.moreFacts,
    charts: preparedWithAssets.charts,
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
  const lensesDocument = { schema: "cssearth-prepared-lenses@1", objectId: preparedWithAssets.objectId, ...preparedWithAssets.lenses };
  const shellLenses = {
    title: preparedWithAssets.lenses.title,
    defaultLens: preparedWithAssets.lenses.defaultLens,
    controls: preparedWithAssets.lenses.controls.map(({ id, label, thumbnailUrl, noData, facts, legend, legendNote, volume }) => ({
      id,
      label,
      thumbnailUrl,
      ...(volume ? { volume } : {}),
      ...(noData === true ? { noData } : {}),
      ...(facts?.length ? { facts } : {}),
      ...(legend ? { legend } : {}),
      ...(legendNote ? { legendNote } : {}),
    })),
  };
  const controls = {
    lenses: shellLenses.controls.length ? shellLenses : null,
    settings: preparedWithAssets.settings,
  };
  await mkdir(publicDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "content.json"), `${JSON.stringify(content)}\n`),
    writeFile(resolve(outputDirectory, "lenses.json"), `${JSON.stringify(lensesDocument)}\n`),
    writeFile(resolve(outputDirectory, "controls.json"), `${JSON.stringify(controls)}\n`),
  ]);
  return {
    id: preparedWithAssets.objectId,
    content,
    lenses: preparedWithAssets.lenses,
    controls,
    files: ["content.json", "lenses.json", "controls.json"],
  };
}

async function prepareRasterLegendAssets(
  source: ObjectContentSource,
  sourceDirectory: string,
  publicDirectory: string,
): Promise<void> {
  const sharp = (await import("sharp")).default;
  for (const control of source.lenses.controls) {
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

async function deriveLensBillboardColors(
  lenses: PreparedObjectContent["lenses"],
  publicDirectory: string,
): Promise<PreparedObjectContent["lenses"]> {
  const colors = await lensBillboardColors(lenses.controls, lenses.defaultLens, publicDirectory);
  return {
    ...lenses,
    controls: lenses.controls.map((control) => ({
      ...control,
      billboardColor: colors.get(typeof control.id === "string" ? control.id : "") ??
        (control.view === "interior" ? colors.get(lenses.defaultLens) : undefined),
    })),
  };
}
