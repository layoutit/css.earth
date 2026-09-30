/** Where a rover stood for a panorama: its PDS PLACES localisation at the panorama's first sol. */

export interface PlacesRow {
  readonly frame: 'SITE' | 'ROVER';
  readonly site: number;
  readonly drive: number;
  readonly sol: number;
  readonly latitudeDeg: number;
  readonly longitudeDegEast: number;
}

export interface PanoramaSite {
  readonly latitudeDeg: number;
  readonly longitudeDegEast: number;
  /** The localisation row that places it, for the reader and the README. */
  readonly localization: string;
}

/** Rows of a PLACES localisation table (`frame,site,drive,…,planetocentric_latitude,…,longitude,…,sol`). */
export function parsePlacesTable(csv: string, file: string): PlacesRow[] {
  const lines = csv.split(/\r?\n/u).filter(line => line.trim());
  const header = lines.shift()?.split(',') ?? [];
  const column = (name: string) => { const at = header.indexOf(name); if (at < 0) throw new TypeError(`${file} has no ${name} column.`); return at; };
  const frame = column('frame'), site = column('site'), drive = column('drive'), sol = column('sol'), latitude = column('planetocentric_latitude'), longitude = column('longitude');
  return lines.map((line, index) => {
    const cells = line.split(','), at = `${file} row ${index + 2}`;
    const kind = cells[frame];
    if (kind !== 'SITE' && kind !== 'ROVER') throw new TypeError(`${at} has frame ${kind}, not SITE or ROVER.`);
    const numbers = [site, drive, sol, latitude, longitude].map(position => Number(cells[position]));
    if (!numbers.every(Number.isFinite)) throw new TypeError(`${at} has a non-numeric site, drive, sol or position.`);
    const [siteValue, driveValue, solValue, latitudeDeg, longitudeDeg] = numbers as [number, number, number, number, number];
    return { frame: kind, site: siteValue, drive: driveValue, sol: solValue, latitudeDeg, longitudeDegEast: longitudeDeg < 0 ? longitudeDeg + 360 : longitudeDeg >= 360 ? longitudeDeg - 360 : longitudeDeg };
  });
}

/**
 * The rover's place over `[first, last]`: its last localised drive on or before the first sol, or, before its first
 * drive, the origin of the site frame that drive starts in. Rows without a sol (-1) cannot be dated and are skipped. A
 * drive inside the sols means the images were not taken from one place, which fails.
 */
export function locatePanorama(rows: readonly PlacesRow[], [first, last]: readonly [number, number], label: string): PanoramaSite {
  const drives = rows.filter(row => row.frame === 'ROVER' && row.sol >= 0)
    .sort((a, b) => a.sol - b.sol || a.site - b.site || a.drive - b.drive);
  if (!drives.length) throw new TypeError(`${label}: the localisation table has no dated rover rows.`);
  const moved = drives.filter(row => row.sol > first && row.sol <= last);
  if (moved.length) throw new TypeError(`${label}: the rover drove during sols ${first}–${last} (site ${moved[0]!.site} drive ${moved[0]!.drive} on sol ${moved[0]!.sol}).`);
  const before = drives.filter(row => row.sol <= first).at(-1);
  if (before) return Object.freeze({ latitudeDeg: before.latitudeDeg, longitudeDegEast: before.longitudeDegEast, localization: `site ${before.site} drive ${before.drive}, sol ${before.sol}` });
  const firstDrive = drives[0]!, origin = rows.find(row => row.frame === 'SITE' && row.site === firstDrive.site);
  if (!origin) throw new TypeError(`${label}: sol ${first} precedes the first drive and site ${firstDrive.site} has no origin row.`);
  return Object.freeze({ latitudeDeg: origin.latitudeDeg, longitudeDegEast: origin.longitudeDegEast, localization: `site ${origin.site} origin, before the first drive on sol ${firstDrive.sol}` });
}
