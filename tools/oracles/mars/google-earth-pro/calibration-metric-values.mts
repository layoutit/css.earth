import { array, object, text, finite, boolean, strings } from './oracle-values.mts';
import { parseCrop } from './rendered-motion-records.mts';

export function parseDisc(value: unknown) {
  const disc = object(value);
  return { ...disc, minX: finite(disc.minX), maxX: finite(disc.maxX),
    centerX: finite(disc.centerX), centerY: finite(disc.centerY), width: finite(disc.width), height: finite(disc.height) };
}
export type Disc = ReturnType<typeof parseDisc>;
export interface DecodedImage { width: number; height: number; data: Uint8Array; }
export interface Endpoint { angularResidualDegrees: number; screenRollDegrees: number; }
export interface PairOptions { id: string; nativePath: string; browserPath: string; nativeDisc: Disc; browserDisc: Disc;
  browserEndpoint: Endpoint; centerAddressMatches: boolean; coverage: readonly string[]; output: string; }
export function parseNativeRegistration(value: unknown) {
  const row = object(value);
  return { ...row, qualification: text(row.qualification),
    calibration: { sourceDecodedRgbaSha256: text(object(row.calibration).sourceDecodedRgbaSha256) },
    captures: array(row.captures).map(value => { const capture = object(value), final = object(capture.final);
      return { ...capture, id: text(capture.id), coverage: strings(capture.coverage), final: { ...final, path: text(final.path), crop: parseCrop(final.crop) } }; }) };
}
export function parseBrowserRegistration(value: unknown) {
  const row = object(value);
  return { ...row, viewport: row.viewport, qualification: text(row.qualification), crop: parseCrop(row.crop),
    calibration: { sourceDecodedRgbaSha256: text(object(row.calibration).sourceDecodedRgbaSha256) },
    densities: array(row.densities).map(value => { const density = object(value); return { ...density, density: finite(density.density),
      captures: array(density.captures).map(value => { const capture = object(value), endpoint = object(capture.browserEndpoint);
        return { ...capture, id: text(capture.id), path: text(capture.path), nativeDisc: parseDisc(capture.nativeDisc),
          browserDisc: parseDisc(capture.browserDisc), centerAddressMatches: boolean(capture.centerAddressMatches),
          browserEndpoint: { angularResidualDegrees: finite(endpoint.angularResidualDegrees), screenRollDegrees: finite(endpoint.screenRollDegrees) } }; }) }; }) };
}
