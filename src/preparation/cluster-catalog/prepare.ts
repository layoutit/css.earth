import { M_PER_PC } from '@cssearth/astronomy';
import type { PreparedClusterCatalog, PreparedClusterRecord, SpatialCatalogSource } from '@cssearth/catalog';
import { galaxyPositionM } from '../galaxy-catalog/prepare.js';

export interface ClusterSelection { readonly id: string; readonly name: string; readonly catalogueId: string; readonly aliases: readonly string[] }
export interface ClusterRecipe {
  readonly schema: 'cssearth-cluster-catalog-source@1';
  readonly frame: PreparedClusterCatalog['frame'];
  readonly cosmology: PreparedClusterCatalog['cosmology'];
  readonly sources: readonly (SpatialCatalogSource & { readonly path: string })[];
  readonly catalogueSourceId: string;
  readonly rowCount: number;
  readonly selection: readonly ClusterSelection[];
  readonly description: string;
  readonly distanceCaveat: string;
}
export interface McxcRow {
  readonly catalogueId: string; readonly originalName: string; readonly alternateName: string;
  readonly raDeg: number; readonly decDeg: number; readonly redshift: number;
  readonly redshiftType: string; readonly redshiftRef: string; readonly scaleKpcPerArcsec: number; readonly r500Mpc: number;
}

/** Fixed-width columns are the pinned CDS ReadMe's one-based inclusive byte ranges. */
export function parseMcxcRows(text: string): readonly McxcRow[] {
  const ids = new Set<string>();
  return text.replace(/\r?\n$/, '').split(/\r?\n/).map(line => {
    const field = (start: number, end: number) => line.slice(start - 1, end).trim();
    const number = (start: number, end: number) => {
      const value = field(start, end), n = Number(value);
      if (!value || !Number.isFinite(n)) throw new TypeError('Invalid MCXC-II numeric column.'); return n;
    };
    const catalogueId = field(6, 22);
    if (line.length !== 1264 || !/^MCXC J\d{4}\.\d[+-]\d{4}$/.test(catalogueId) || ids.has(catalogueId)) throw new TypeError('Invalid or duplicate MCXC-II row.');
    ids.add(catalogueId);
    return { catalogueId, originalName: field(24, 41), alternateName: field(43, 96),
      raDeg: number(120, 127), decDeg: number(129, 136), redshift: number(182, 189),
      redshiftType: field(191, 192), redshiftRef: field(194, 227),
      scaleKpcPerArcsec: number(242, 247), r500Mpc: number(330, 335) };
  });
}

/** Flat matter + Lambda cosmology adopted by MCXC-II; not a peculiar-velocity correction. */
export function comovingDistanceMpc(redshift: number, hubbleKmPerSecPerMpc: number, omegaMatter: number): number {
  if (![redshift, hubbleKmPerSecPerMpc, omegaMatter].every(Number.isFinite) || redshift <= 0 || redshift > 2 || hubbleKmPerSecPerMpc <= 0 || omegaMatter < 0 || omegaMatter > 1) throw new TypeError('Invalid cluster distance cosmology.');
  const intervals = 1024, step = redshift / intervals;
  let sum = 0;
  for (let i = 0; i <= intervals; i++) {
    const weight = i === 0 || i === intervals ? 1 : i % 2 === 0 ? 2 : 4;
    sum += weight / Math.sqrt(omegaMatter * (1 + i * step) ** 3 + 1 - omegaMatter);
  }
  return 299792.458 / hubbleKmPerSecPerMpc * step * sum / 3;
}

export function prepareClusterCatalog(rows: readonly McxcRow[], recipe: ClusterRecipe): PreparedClusterCatalog {
  if (recipe.schema !== 'cssearth-cluster-catalog-source@1' || rows.length !== recipe.rowCount || recipe.cosmology.model !== 'flat-lambda-cdm') throw new TypeError('Cluster source recipe does not match its release.');
  const byId = new Map(rows.map(row => [row.catalogueId, row]));
  const objects: PreparedClusterRecord[] = recipe.selection.map(selection => {
    const row = byId.get(selection.catalogueId);
    if (!row) throw new TypeError(`Missing selected cluster: ${selection.catalogueId}`);
    const distanceMpc = comovingDistanceMpc(row.redshift, recipe.cosmology.hubbleKmPerSecPerMpc, recipe.cosmology.omegaMatter);
    // Independent published angular-scale column checks units and cosmology.
    const angularScale = distanceMpc / (1 + row.redshift) * 1000 * Math.PI / (180 * 3600);
    if (Math.abs(angularScale - row.scaleKpcPerArcsec) > .000051) throw new TypeError(`MCXC-II angular scale disagrees with adopted cosmology: ${row.catalogueId}`);
    const ref = `${recipe.catalogueSourceId}:${row.catalogueId}`, properRadiusM = row.r500Mpc * 1e6 * M_PER_PC;
    const comovingRadiusM = properRadiusM * (1 + row.redshift);
    return { id: selection.id, name: selection.name, kind: 'galaxy-cluster', status: 'confirmed',
      aliases: [...new Set([...selection.aliases, row.originalName, row.alternateName, row.catalogueId].filter(Boolean))],
      positionM: galaxyPositionM(row.raDeg, row.decDeg, distanceMpc * 1e6),
      skyPosition: { raDeg: row.raDeg, decDeg: row.decDeg, sourceRef: ref },
      distance: { valuePc: distanceMpc * 1e6, method: 'Redshift-derived comoving distance in flat ΛCDM; peculiar velocities are not corrected.', sourceRef: ref },
      redshift: { value: row.redshift, type: row.redshiftType, sourceRef: row.redshiftRef },
      classification: { name: 'X-ray selected galaxy cluster', sourceRef: ref,
        basis: 'MCXC-II R500 is an X-ray-derived overdensity aperture (500 times the critical density), not the cluster boundary or member distribution.' },
      aperture: { definition: 'R500', properRadiusM, comovingRadiusM, sourceRef: ref },
      presentation: { focusRadiusM: comovingRadiusM * 1.5 } };
  });
  return { schema: 'cssearth-cluster-catalog@1', frame: recipe.frame, cosmology: recipe.cosmology,
    sources: recipe.sources.map(({ path: _path, ...source }) => source), objects,
    selection: { description: recipe.description, distanceCaveat: recipe.distanceCaveat } };
}
