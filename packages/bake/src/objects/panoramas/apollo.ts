/** Where an Apollo photographer stood and where the hardware was: LROC's Apollo shapefile archives map each Hasselblad
 * photograph's standpoint (its `HBLADS` layer) and the equipment left on the surface (its `EQUIPMENT` layer). */
import { equidistantCylindricalInverse, parseDbf, parseShpRecords, unzipMember } from '../gis/index.ts';
import type { SurfacePoint } from './register.ts';

export interface HasselbladStandpoint extends SurfacePoint {
  /** The record that places it, for the reader and the README. */
  readonly localization: string;
  /** Ground elapsed time of the photographs, `HHH:MM:SS`. */
  readonly groundElapsed: string;
}

function pointLayer(archive: string, layer: string): { readonly rows: readonly Readonly<Record<string, string>>[]; readonly points: readonly (SurfacePoint | null)[] } {
  const inverse = equidistantCylindricalInverse(new TextDecoder().decode(unzipMember(archive, `${layer}.PRJ`)), `${archive} ${layer}.PRJ`);
  const table = parseDbf(unzipMember(archive, `${layer}.DBF`)), shapes = parseShpRecords(unzipMember(archive, `${layer}.SHP`));
  if (shapes.records.length !== table.rows.length) throw new TypeError(`${archive} ${layer}: ${shapes.records.length} shapes but ${table.rows.length} attribute rows.`);
  return { rows: table.rows, points: shapes.records.map(shape => {
    if (!shape?.point) return null;
    const [longitudeDegEast, latitudeDeg] = inverse(shape.point[0], shape.point[1]);
    return { latitudeDeg, longitudeDegEast };
  }) };
}

/** The standpoint of the photograph `frame` of `magazine`, from the Hasselblad layer's frame lists. */
export function hasselbladStandpoint(archive: string, layer: string, magazine: string, frame: string, label: string): HasselbladStandpoint {
  const { rows, points } = pointLayer(archive, layer);
  const matches = rows.flatMap((row, index) => row.Magazine === magazine && `${row.IDList ?? ''},${row.IDListCont ?? ''}`.split(',').map(entry => entry.trim()).includes(frame) ? [index] : []);
  if (matches.length !== 1) throw new TypeError(`${label}: ${layer} has ${matches.length} records listing magazine ${magazine} frame ${frame}, not one.`);
  const index = matches[0]!, row = rows[index]!, point = points[index];
  if (!point) throw new TypeError(`${label}: ${layer} record ${row.ID} has no point.`);
  const groundElapsed = row.G_E_Time ?? '';
  if (!/^\d{3}:\d{2}:\d{2}$/u.test(groundElapsed)) throw new TypeError(`${label}: ${layer} record ${row.ID} has ground elapsed time "${groundElapsed}", not HHH:MM:SS.`);
  const station = row.Station?.trim();
  return { ...point, groundElapsed, localization: `LROC ${layer} ${row.ID}${station ? `, ${station}` : ''}, GET ${groundElapsed}` };
}

/** Every named piece of hardware in the archive's equipment layer. */
export function apolloEquipment(archive: string, layer: string): ReadonlyMap<string, SurfacePoint> {
  const { rows, points } = pointLayer(archive, layer), equipment = new Map<string, SurfacePoint>();
  rows.forEach((row, index) => { const name = row.Equipment?.trim(), point = points[index]; if (name && point) equipment.set(name, point); });
  return equipment;
}

/** Range zero plus a ground elapsed time, as `YYYY-MM-DDTHH:MMZ`, the minute it falls in. */
export function groundElapsedUtc(rangeZeroUtc: string, groundElapsed: string): string {
  const [hours, minutes, seconds] = groundElapsed.split(':').map(Number) as [number, number, number];
  const time = new Date(Date.parse(rangeZeroUtc) + ((hours * 60 + minutes) * 60 + seconds) * 1000);
  if (Number.isNaN(time.getTime())) throw new TypeError(`Range zero ${rangeZeroUtc} is not a UTC time.`);
  return `${time.toISOString().slice(0, 16)}Z`;
}
