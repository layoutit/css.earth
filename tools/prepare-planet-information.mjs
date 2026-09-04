import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PLANET_INFORMATION_SOURCES,
  planetInformationSource,
  validatePlanetInformationSnapshot,
} from "./planet-information-sources.mjs";

const OUTPUT_DIRECTORY = fileURLToPath(
  new URL("../data/planets/", import.meta.url),
);

const SELECTED_SECTIONS = new Set([
  "Introduction",
  "Namesake",
  "Potential for Life",
  "Size and Distance",
  "Orbit and Rotation",
  "Moons",
  "Rings",
  "Formation",
  "Structure",
  "Surface",
  "Atmosphere",
  "Magnetosphere",
]);

const ALLOWED_INLINE_TAGS = new Set([
  "a",
  "b",
  "br",
  "em",
  "i",
  "strong",
  "sub",
  "sup",
]);

const ENTITY_VALUES = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
});

export async function preparePlanetInformation(
  args = process.argv.slice(2),
  { outputDirectory = OUTPUT_DIRECTORY } = {},
) {
  const { requestedIds, verifyLocal } = parseCommandArguments(args);
  if (verifyLocal) return verifyLocalSnapshots(requestedIds, outputDirectory);

  const prepared = await Promise.all(requestedIds.map((id) =>
    preparePlanet(planetInformationSource(id))));
  await publishPlanetInformation(prepared, { outputDirectory });
  for (const snapshot of prepared) {
    console.log(
      `Prepared ${snapshot.planet} information -> ${
        resolve(outputDirectory, `${snapshot.id}.json`)}`,
    );
  }
  return Object.freeze(prepared);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await preparePlanetInformation();
}

async function preparePlanet(config) {
  const { recordApiUrl, blocksApiUrl } = config;
  const [record, response] = await Promise.all([
    fetchJson(recordApiUrl, `${config.name} record`),
    fetchJson(blocksApiUrl, `${config.name} block feed`),
  ]);

  validateRecord(record, config);
  const blocks = response?.blocks;
  if (!Array.isArray(blocks)) {
    throw new Error(
      `${config.name} block feed schema changed: expected an object with a blocks array.`,
    );
  }

  const pageIntroBlocks = blocks.filter(({ name }) => name === "nasa-blocks/page-intro");
  if (pageIntroBlocks.length !== 1) {
    throw new Error(
      `${config.name} block feed schema changed: expected exactly one nasa-blocks/page-intro block, received ${pageIntroBlocks.length}.`,
    );
  }

  const introduction = cleanInlineText(
    pageIntroBlocks[0]?.attributes?.description,
    `${config.name} page introduction`,
  );
  const sections = selectSections(blocks, config.name);
  if (sections.length < 8) {
    throw new Error(
      `${config.name} block feed schema changed: expected at least 8 selected editorial sections, received ${sections.length}.`,
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    id: config.id,
    planet: config.name,
    title: cleanInlineText(record.title.rendered, `${config.name} title`),
    introduction,
    sections,
    sourceUrl: record.link,
    sourceId: config.sourceId,
    modified: record.modified,
    retrievedAt: new Date().toISOString().slice(0, 10),
    credit: "NASA Science",
    recordApiUrl,
    blocksApiUrl,
  });
}

function selectSections(blocks, planetName) {
  const sections = [];
  let activeSection = null;

  for (const block of blocks) {
    if (block?.name === "core/heading") {
      const heading = cleanInlineText(
        block?.attributes?.stripped_content ?? block?.attributes?.content,
        `${planetName} section heading`,
      );
      activeSection = SELECTED_SECTIONS.has(heading)
        ? { heading, paragraphs: [] }
        : null;
      if (activeSection) sections.push(activeSection);
      continue;
    }

    if (block?.name !== "core/paragraph" || !activeSection) continue;
    const paragraph = cleanInlineText(
      block?.attributes?.content,
      `${planetName} ${activeSection.heading} paragraph`,
    );
    if (paragraph) activeSection.paragraphs.push(paragraph);
  }

  for (const section of sections) {
    if (section.paragraphs.length === 0) {
      throw new Error(
        `${planetName} block feed schema changed: ${section.heading} has no paragraph blocks.`,
      );
    }
  }

  return sections;
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 360);
    throw new Error(`${label} request failed (${response.status}): ${detail}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} did not return valid JSON: ${error.message}`);
  }
}

function validateRecord(record, config) {
  if (record?.id !== config.sourceId) {
    throw new Error(
      `${config.name} record mismatch: expected source ID ${config.sourceId}, received ${record?.id}.`,
    );
  }
  if (record?.title?.rendered !== config.expectedTitle) {
    throw new Error(
      `${config.name} title mismatch: expected ${JSON.stringify(config.expectedTitle)}, received ${JSON.stringify(record?.title?.rendered)}.`,
    );
  }
  if (record?.link !== config.sourceUrl) {
    throw new Error(
      `${config.name} canonical URL mismatch: expected ${config.sourceUrl}, received ${record?.link}.`,
    );
  }
  if (typeof record?.modified !== "string" || !record.modified) {
    throw new Error(`${config.name} record is missing its modified timestamp.`);
  }
}

function cleanInlineText(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} is missing or is not text.`);
  }

  for (const match of value.matchAll(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi)) {
    const tagName = match[1].toLowerCase();
    if (!ALLOWED_INLINE_TAGS.has(tagName)) {
      throw new Error(`${label} contains unsupported inline markup: <${tagName}>.`);
    }
  }

  const withoutMarkup = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "");
  const decoded = withoutMarkup.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, name) => decodeEntity(entity, name),
  );
  if (/&(?:#x?[0-9a-f]+|[a-z]+);/i.test(decoded)) {
    throw new Error(`${label} contains an unsupported HTML entity.`);
  }
  return decoded.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntity(entity, name) {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith("#x")) {
    return String.fromCodePoint(Number.parseInt(lowerName.slice(2), 16));
  }
  if (lowerName.startsWith("#")) {
    return String.fromCodePoint(Number.parseInt(lowerName.slice(1), 10));
  }
  if (Object.hasOwn(ENTITY_VALUES, lowerName)) return ENTITY_VALUES[lowerName];
  return entity;
}

async function verifyLocalSnapshots(ids, outputDirectory) {
  const snapshotIds = ids.length > 0
    ? ids
    : (await readdir(outputDirectory))
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -5));
  const snapshots = [];
  for (const id of snapshotIds) {
    planetInformationSource(id);
    const snapshot = JSON.parse(await readFile(
      resolve(outputDirectory, `${id}.json`),
      "utf8",
    ));
    validatePlanetInformationSnapshot(snapshot);
    snapshots.push(snapshot);
  }
  console.log(`Verified ${snapshots.length} local NASA Science planet snapshots.`);
  return Object.freeze(snapshots);
}

export async function publishPlanetInformation(
  snapshots,
  { outputDirectory = OUTPUT_DIRECTORY, fileOperations = defaultFileOperations() } = {},
) {
  const serialized = snapshots.map((snapshot) => {
    validatePlanetInformationSnapshot(snapshot);
    return Object.freeze({
      id: snapshot.id,
      bytes: `${JSON.stringify(snapshot, null, 2)}\n`,
    });
  });
  if (serialized.length === PLANET_INFORMATION_SOURCES.length &&
      serialized.every(({ id }, index) =>
        id === PLANET_INFORMATION_SOURCES[index].id)) {
    await publishCompleteBatch(serialized, outputDirectory, fileOperations);
    return;
  }
  await fileOperations.mkdir(outputDirectory, { recursive: true });
  for (const snapshot of serialized) {
    await publishOne(snapshot, outputDirectory, fileOperations);
  }
}

async function publishCompleteBatch(snapshots, outputDirectory, operations) {
  const parent = dirname(outputDirectory);
  await operations.mkdir(parent, { recursive: true });
  const staging = await operations.mkdtemp(resolve(parent, ".planets-staging-"));
  const backup = resolve(parent, `.planets-backup-${randomUUID()}`);
  let previousMoved = false;
  try {
    for (const snapshot of snapshots) {
      await operations.writeFile(
        resolve(staging, `${snapshot.id}.json`),
        snapshot.bytes,
      );
    }
    try {
      await operations.rename(outputDirectory, backup);
      previousMoved = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    try {
      await operations.rename(staging, outputDirectory);
    } catch (error) {
      if (previousMoved) {
        try {
          await operations.rename(backup, outputDirectory);
        } catch (restoreError) {
          throw new Error(
            `Planet information publication failed and the previous batch could not be restored from ${backup}.`,
            { cause: new AggregateError([error, restoreError]) },
          );
        }
      }
      throw error;
    }
    if (previousMoved) await operations.rm(backup, { force: true, recursive: true });
  } finally {
    await operations.rm(staging, { force: true, recursive: true });
  }
}

async function publishOne(snapshot, outputDirectory, operations) {
  const output = resolve(outputDirectory, `${snapshot.id}.json`);
  const temporary = `${output}.partial-${process.pid}-${randomUUID()}`;
  try {
    await operations.writeFile(temporary, snapshot.bytes, { flag: "wx" });
    await operations.rename(temporary, output);
  } finally {
    await operations.rm(temporary, { force: true });
  }
}

function parseCommandArguments(args) {
  const verifyLocal = args.includes("--verify-local");
  const requested = args.filter((argument) =>
    argument !== "--" && argument !== "--verify-local");
  const requestedIds = requested.length === 0 && !verifyLocal
    ? PLANET_INFORMATION_SOURCES.map(({ id }) => id)
    : [...new Set(requested)];
  for (const id of requestedIds) planetInformationSource(id);
  return Object.freeze({ requestedIds, verifyLocal });
}

function defaultFileOperations() {
  return Object.freeze({ mkdir, mkdtemp, rename, rm, writeFile });
}
