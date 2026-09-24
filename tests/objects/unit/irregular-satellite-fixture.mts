import { array, boolean, dictionary, number, shape, text } from '@cssearth/core';
import { parseSolidPreparationSource } from '../../../tools/objects/terrestrial-layers/profile-source.mts';

export function irregularSatelliteConfig(input: unknown) {
  const config = parseSolidPreparationSource(input);
  const radial = config.geometry.radialTerrain;
  if (!radial?.simplification) throw new TypeError('Expected the satellite source mesh simplification.');
  return { ...config, geometry: { ...config.geometry,
    radialTerrain: { ...radial, simplification: radial.simplification } } };
}
const vector = (input: unknown) => {
  const values = array(number)(input);
  if (values.length !== 3) throw new TypeError('Expected a three-coordinate satellite position.');
  return values;
};
export const satelliteOrbitEvidence = shape({ additionalPositionGuardKm: number,
  runs: array(shape({ label: text, comparisons: array(shape({ jdTdb: number, expectedPositionKm: vector })) })) });
export const satelliteSurvey = shape({
  identity: shape({ targetNaif: text, designation: text, solution: text }),
  rotation: shape({ tentative: boolean }), scale: shape({ geometricAlbedoAssumption: number }),
});
export const satelliteContent = shape({
  lenses: shape({ controls: array(shape({ id: text, notes: text })) }),
  panel: shape({ facts: array(shape({ id: text, value: text })) }),
});
/** Published reader text: each dataset's chooser detail and summary. */
export const satelliteText = shape({ datasets: dictionary(shape({ detail: text, summary: text })) });
export const satelliteRotation = shape({ phase: text, declinationDegrees: number });
export const simplifiedSatelliteReport = shape({ topology: shape({ eulerCharacteristic: number, signedVolumeCubicMeters: number }) });
