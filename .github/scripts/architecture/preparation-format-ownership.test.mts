import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
// All distinctive diagnostics, including nested parsers and the derived-field paged policy.
// Generic object/text/number helper wording is shared by unrelated formats and is not an ownership marker.
const contracts = [
  {
    "owner": "packages/objects/src/prepared-data/orbit/solar-system-preparation.ts",
    "diagnostics": [
      "solar-system source must be an object.",
      "Solar-system source is invalid."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/source/investigation-ledger.ts",
    "diagnostics": [
      "expects objectId",
      "expects facilityId",
      "expects schema ${INVESTIGATION_LEDGER_SCHEMA}",
      "expects entries",
      "repeats id",
      "expects status"
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/source/acquisition-plan.ts",
    "diagnostics": [
      "Expected acquisition object.",
      "Invalid acquisition plan.",
      "Acquisition URL or groups are missing.",
      "Unknown acquisition operator.",
      "Invalid acquisition path.",
      "Acquisition destination is missing.",
      "Invalid Horizons time list.",
      "Invalid tar.gz member.",
      "Invalid ZIP member.",
      "Acquisition headers must be text.",
      "Acquisition form values must be text.",
      "Invalid response text transformation.",
      "Unknown source download encoding.",
      "Invalid source response checks.",
      "Response replacements must be an array.",
      "Invalid response text replacement.",
      "Invalid HRII facet acquisition.",
      "GeoTIFF grid recipe is missing.",
      "Invalid numeric-map acquisition.",
      "Satellite catalog recipe is missing.",
      "Invalid mosaic",
      ": missingCoverage must be \"transparent\" and needs the mosaic kept at its data size, not",
      "Invalid source response comparator.",
      "Source marker is missing."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/presentation/css-geometry-profile.ts",
    "diagnostics": [
      "needs an asset and positive raster dimensions.",
      "Unsupported geometry profile.",
      "surface.${name} must be positive.",
      "Surface segmentation is invalid.",
      "Surface mapping is invalid.",
      "Projection needs a light color.",
      "projection.${name} must be boolean.",
      "projection.positionVariables is gone: remove it.",
      ") and overlap x texels per cell = rasterOverscan (overlap",
      "geometry.planes must be a non-empty array.",
      "A plane needs a positive radius and raster size.",
      "A plane needs an identifier and color.",
      "A plane needs a prepared asset.",
      "Cutaway color is invalid.",
      "Scene output profile is invalid.",
      "Cutaway schema declarations are missing.",
      "Body rotation direction is missing.",
      "Animation direction is missing."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/presentation/paged-ellipsoid.ts",
    "diagnostics": [
      ", which preparation derives.",
      ": paged ellipsoid zoom limit needs atlas.sourceWidth, atlas.density and textureLevels.texelsPerCssPixel; found",
      ": paged-ellipsoid camera.drag.model must be screen-axis-tumble or pole-held-tumble; found"
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/photometry/chart-assets.ts",
    "diagnostics": [
      "Unsafe chart source path.",
      "${label} must contain finite samples.",
      "Unknown chart recipe schema.",
      "Chart asset base must be an absolute URL prefix.",
      ": unknown chart operator",
      ": a folded transit names its light-curve files.",
      ": a folded transit needs a positive duration, bin width and notes.",
      ": alignMinutes is a shift of at most 720 minutes, not",
      "Invalid light curve profile.",
      "Invalid light curve event.",
      "Invalid pressure profile.",
      "Invalid phase model.",
      "Invalid phase segment.",
      "Invalid phase constant.",
      "Phase segments do not cover the model.",
      "Gallery item count is invalid."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/photometry/chart-measured-spectrum.ts",
    "diagnostics": [
      "Spectrum path must stay inside the source directory.",
      "Invalid measured-spectrum axis.",
      "Invalid measured-spectrum kind or mode.",
      "Unknown measurement source format.",
      "Invalid chart id.",
      "Chart notes exceed the prepared layout."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/photometry/chart-retrieved-profile.ts",
    "diagnostics": [
      "Profile path must stay inside the source directory.",
      "Invalid profile row count or column.",
      "Profile ranges must be positive and increasing.",
      "Invalid profile axis ticks.",
      "Invalid retrieved-profile identity.",
      "Profile pressure unit must be Pa or bar.",
      "Invalid profile color.",
      "Profile columns must be distinct.",
      "Profile text exceeds the prepared layout.",
      "Probed pressures lie outside the plot."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/photometry/chart-system-orbits.ts",
    "diagnostics": [
      ": a system-orbits chart has kind system-orbits and a lowercase id."
    ]
  },
  {
    "owner": "packages/objects/src/prepared-data/photometry/chart-spectrum.ts",
    "diagnostics": [
      "source must be text.",
      "Invalid spectrum sampling profile.",
      "Spectrum ${key} must be text.",
      "Unknown spectrum source format.",
      "Spectrum ${key} must be positive.",
      "Spectrum ${key} is missing."
    ]
  },
  {
    "owner": "packages/objects/src/volume/nebula/nebula-depth-model.ts",
    "diagnostics": [
      "Invalid depth-model pair.",
      "Invalid evidence-addressed depth surface.",
      "Invalid nebula depth-model recipe.",
      "Invalid depth frame, duplicate surface, or unsupported background claim."
    ]
  }
] as const;

// Exceptions admit one exact executor-policy line, never an entire caller file.
const policyExceptions = [
  {
    "path": "packages/bake/src/objects/acquisition/operations-acquisition.ts",
    "diagnostic": "Expected acquisition object.",
    "line": "const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected acquisition object.');return value as Record<string,unknown>;};",
    "reason": "The acquisition executor validates fetched JSON before comparing source identity fields."
  },
  {
    "path": "site/overview/spectrum-data.mts",
    "diagnostic": "Unknown spectrum source format.",
    "line": "  } else throw new TypeError('Unknown spectrum source format.');",
    "reason": "The source-data reader guards its own sampling dispatch after recipe admission."
  }
] as const;

const readerContracts = [
  { id: 'A236', readers: [
    ['packages/bake/src/objects/celestial/celestial.ts', 'parseSolarSceneSource(JSON.parse'],
    ['site/build/prepare/prepare-world-navigation.ts', "parseSolarSceneSource(sources.get('solar-system'), 'units')"]] },
  { id: 'A237-ledger', readers: [
    ['packages/bake/src/sources/investigation-ledger.ts', 'parseSharedInvestigationLedger(value,'],
    ['packages/bake/src/sources/investigation-ledger.ts', 'parseSharedFacilityLedger(value,']] },
  { id: 'A237', readers: [
    ['packages/bake/src/objects/acquisition/operations-acquisition.ts', 'parseSharedAcquisitionPlan(value,']] },
  { id: 'A238', readers: [
    ['packages/bake/src/scene/profile.ts', "export { parseGeometryProfile, type GeometryProfile } from '@cssearth/objects'"]] },
  { id: 'A239', readers: [
    ['packages/bake/src/objects/layers/paged-ellipsoid/globe/profile-source.ts', 'parsePagedRecipe(value)'],
    ['site/build/prepare/prepare-world-navigation.ts', "parsePagedRecipe(paged, 'surface-arc')"],
    ['site/build/prepare/prepare-world-navigation.ts', "parsePagedRecipe(paged, 'drag')"]] },
  { id: 'A240', readers: [
    ['site/build/charts/charts.ts', 'parseChartAssetRecipe(config)'],
    ['site/build/charts/charts.ts', 'resolve(root,chartSourcePath(value))'],
    ['site/overview/spectrum-data.mts', 'parseSpectrumRecipe(input)'],
    ['packages/bake/src/objects/charts/measured-spectrum.ts', 'parseMeasuredSpectrum(input)'],
    ['packages/bake/src/objects/charts/retrieved-profile.ts', 'parseRetrievedProfile(input)'],
    ['packages/bake/src/objects/charts/system-orbits.ts', "from '@cssearth/objects'"]] },
  { id: 'A241', readers: [
    ['labs/nebula/packages/reconstruction/src/methods/inference/depth-model.ts', 'parseDepthRecipe(v, path => jointPath(path) && allowedPath(path))']] },
] as const;

const parserNames = ['parseSolarSceneSource', 'parseGeometryProfile', 'parseDepthRecipe', 'parsePagedRecipe', 'parseChartAssetRecipe', 'parseMeasuredSpectrum', 'parseRetrievedProfile', 'parseSystemOrbits', 'parseSpectrumRecipe', 'parsePagedDatasetBindings'];
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.ts', '*.mts', '*.js', '*.mjs', '*.astro'], { cwd: root, encoding: 'utf8' }).split('\0');
const sources = new Map([...new Set(paths)].filter(path => /\.(?:ts|mts|js|mjs|astro)$/u.test(path) && !path.includes('.test.')
  && !path.startsWith('output/') && !path.startsWith('untangle/')).map(path => [path, readFileSync(resolve(root, path), 'utf8')]));

test('moved preparation parsers cannot be redeclared outside objects', () => {
  const declarations = [...sources].filter(([path, text]) => !path.startsWith('packages/objects/src/')
    && parserNames.some(name => new RegExp(`\\b(?:function|const)\\s+${name}\\b`, 'u').test(text))).map(([path]) => path);
  assert.deepEqual(declarations, [], 'Pure parsers must have one objects owner');
});

for (const contract of contracts) test(`${contract.owner}: every distinctive diagnostic has one owner`, () => {
  for (const diagnostic of contract.diagnostics) {
    assert.ok(sources.get(contract.owner)?.includes(diagnostic), `Missing shared diagnostic: ${diagnostic}`);
    const copies = [...sources].filter(([path]) => !path.startsWith('packages/objects/src/')).flatMap(([path, text]) => {
      const allowed = policyExceptions.filter(exception => exception.path === path && exception.diagnostic === diagnostic);
      for (const exception of allowed) {
        assert.equal(text.split(exception.line).length - 1, 1, `Changed or duplicated caller policy: ${path}`);
        text = text.replace(exception.line, '');
      }
      return text.split('\n').flatMap((line, index) => line.includes(diagnostic) ? [`${path}:${index + 1}: ${diagnostic}`] : []);
    });
    assert.deepEqual(copies, [], 'Duplicated parser admission');
  }
});

for (const contract of readerContracts) test(`${contract.id}: callers delegate to the shared reader`, () => {
  for (const [path, call] of contract.readers) assert.ok(sources.get(path)?.includes(call), `${contract.id}: ${path} bypasses shared reader`);
});
