import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  assertSaturnSourceBytes,
  saturnSourceManifest,
  validateSaturnSourceGroup,
} from "./source-manifest.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(objectRoot, "source/moons");

const sources = Object.freeze([
  Object.freeze({
    id: "dione",
    filename: "dione.jpg",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/dione/textures/1/dione.jpg",
    sha256: "418fdc4ea2b53103350be26ee8a1569e9d9abd21be32aafaf2e801eeff495077",
  }),
  Object.freeze({
    id: "enceladus",
    filename: "enceladus.jpg",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/enceladus/textures/1/enceladus.jpg",
    sha256: "5ba6590ca057565369bcb5e5785a3d4c0deeb9635af2e20701aa25e5d330ce31",
  }),
  Object.freeze({
    id: "iapetus",
    filename: "iapetus.jpg",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/iapetus/textures/1/iapetus.jpg",
    sha256: "d49a3795bf5e831fb1ce040c58b66a0c81ca1a5d73badca077b24c3c8e67ec9b",
  }),
  Object.freeze({
    id: "mimas",
    filename: "mimas.jpg",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/mimas/textures/1/mimas.jpg",
    sha256: "d55601e1661a9c47046a06303f308f6f32b5e53eeed69ca708ff37b6d0580ffb",
  }),
  Object.freeze({
    id: "rhea",
    filename: "rhea.jpg",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/rhea/textures/1/rhea.jpg",
    sha256: "17df9b4dae4c7e40aa42f0d06e44ca4f7962817a7764e936a01395f6aa2e159f",
  }),
  Object.freeze({
    id: "tethys",
    filename: "tethys.jpg",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/tethys/textures/1/tethys.jpg",
    sha256: "a0c4a0344f2361b781977e9ef9679a8cd99dd6cffacf2c1f1212a3afafa2f7d9",
  }),
  Object.freeze({
    id: "titan",
    filename: "titan.tif",
    url: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/titan/textures/2/Titan_ISS_P19658_Mosaic_Global_4km_os.tif",
    sha256: "5052b9f679d5e5a3e5c35c19bbac8349fcb0a6c17a8b0027b00ed8d735cc1477",
  }),
]);
const entriesByPath = new Map(saturnSourceManifest().inputs.map((entry) =>
  [entry.path, entry]));

if (process.argv.includes("--verify-only")) {
  await validateSaturnSourceGroup("moons");
  console.log("Verified the pinned Saturn moon surface sources.");
  process.exit(0);
}

await mkdir(outputRoot, { recursive: true });

for (const source of sources) {
  const outputPath = resolve(outputRoot, source.filename);
  const path = `moons/${source.filename}`;
  const entry = entriesByPath.get(path);
  if (!entry || entry.expectedSha256 !== source.sha256) {
    throw new Error(`${source.id} does not match the Saturn source manifest.`);
  }
  try {
    const bytes = await readFile(outputPath);
    assertSaturnSourceBytes(entry, bytes);
    console.log(`${source.id}: ${bytes.byteLength} verified bytes`);
    continue;
  } catch (error) {
    if (error?.code !== "ENOENT" && !/source (?:size|hash) drifted/u.test(error.message)) {
      throw error;
    }
  }
  const bytes = await fetchSource(source);
  await publishSourceBytes({
    destination: outputPath,
    bytes,
    entry,
    planetName: "Saturn",
  });
  console.log(`${source.id}: ${bytes.byteLength} acquired bytes`);
}
await validateSaturnSourceGroup("moons");

async function fetchSource(source) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
      }
    }
  }
  throw new Error(`OpenSpace ${source.id} source failed after 4 attempts`, {
    cause: lastError,
  });
}
