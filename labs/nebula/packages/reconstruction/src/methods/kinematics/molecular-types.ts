/** Published molecular line fits: measurements, pointing footprint and inferred quantities stay distinct. */
export interface MolecularSourcePin { url: string; cachePath: string; bytes: number }
export interface MolecularColumn { start: number; end: number; unit: string }
export interface MolecularRecipe {
  schema: 'cssearth-molecular-evidence@1'; id: string; title: string;
  citation: { label: string; doi: string; catalogueDoi: string; paper: MolecularSourcePin; readme: MolecularSourcePin };
  table: MolecularSourcePin & { format: 'cds-fixed-width@1'; records: number;
    columns: { raOffset: MolecularColumn; decOffset: MolecularColumn; intensityLimit: MolecularColumn;
      intensity: MolecularColumn; fwhm: MolecularColumn; velocity: MolecularColumn;
      inferredColumnDensity: MolecularColumn; inferredAbundance: MolecularColumn } };
  tracer: { species: string; transition: string; restFrequencyGHz: number; emissionPhase: string };
  coordinates: { frame: 'J2000'; originJ2000Degrees: { ra: number; dec: number }; originSexagesimal: string;
    raOffsetPositive: 'east' | 'west'; decOffsetPositive: 'north' | 'south'; unit: 'arcsec'; evidence: string };
  velocity: { frame: 'LSR'; positive: 'receding'; unit: 'km/s'; definitionNote: string;
    publishedHeliocentricConversion: { lsrMinusHeliocentricKmS: number; source: string; appliedToMeasurements: false };
    uncertainties: 'not-published'; uncertaintyNote: string };
  instrument: { telescope: string; beamFwhmArcsec: number; mapSpectralResolutionKmS: number;
    backendResolutionsKmS: number[]; gridSpacingsArcsec: number[]; source: string };
  intensity: { scale: 'T_R*'; unit: 'mK'; upperLimitMeaning: string; correctedBeamEfficiency: number; source: string };
  broadLineNotice: { thresholdFwhmKmS: number; source: string };
  expectedCounts: { rows: number; pointings: number; detectedComponents: number; detectedPointings: number; upperLimits: number };
  limitations: string[];
}
export interface MolecularPoint {
  /** Stable only within the exact source table identity; not a catalogue object identifier. */
  id: string; sourceRow: number; pointingKey: string; componentIndex: number;
  sourceRaOffsetArcsec: number; sourceDecOffsetArcsec: number; xWestArcsec: number; yNorthArcsec: number;
  status: 'detection' | 'upper-limit'; intensityMilliKelvin: number; intensityLimit: '<' | null;
  intensityUncertaintyMilliKelvin: number | null; velocityLsrKmS: number | null; velocityUncertaintyKmS: number | null;
  fwhmKmS: number | null; fwhmUncertaintyKmS: number | null; possiblyUnresolvedBlend: boolean;
  /** Paper-derived chemistry is preserved for provenance, never supplied as measured density. */
  inferred: { columnDensityCm2: number | null; fractionalAbundance: number | null };
}
export interface MolecularPointing {
  pointingKey: string; xWestArcsec: number; yNorthArcsec: number; sourceRows: number[]; pointIds: string[];
  detectedComponents: number; upperLimits: number;
}
export interface MolecularCatalogue {
  schema: 'cssearth-molecular-catalogue@1'; recipe: MolecularRecipe; recipeSha256: string;
  points: MolecularPoint[]; pointings: MolecularPointing[];
  diagnostics: { rows: number; pointings: number; detectedComponents: number; detectedPointings: number;
    upperLimits: number; multiComponentPointings: number; maximumComponents: number; broadComponents: number;
    centralPointingPresent: boolean; velocityRangeKmS: [number, number] | null;
    xWestRangeArcsec: [number, number]; yNorthRangeArcsec: [number, number] };
}
