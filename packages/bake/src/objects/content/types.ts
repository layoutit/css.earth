import type { PreparedObjectContent, PreparedObjectContentDocument } from '@cssearth/objects';

export interface PreparedRasterAssets {
  surfaces?: Record<string, { url?: string; url2x?: string; polesUrl?: string; polesUrl2x?: string; coronaUrl?: string; coronaUrl2x?: string; limbUrl?: string; limbUrl2x?: string }>;
  materials?: Record<string, { url?: string; url2x?: string }>;
  atmosphere?: { materialUrl?: string; observationUrl?: string; lightingUrl?: string };
  interior?: Record<string, unknown>;
}

export interface ContentPreparationConfig {
  contentPath?: string;
  assetsPath?: string;
  chartsPath?: string;
}

export interface ContentPreparationContext {
  sourceDirectory: string;
  publicDirectory: string;
  outputDirectory: string;
  config: ContentPreparationConfig;
}

export interface PreparedObjectContentAssets {
  id: string;
  content: PreparedObjectContentDocument;
  datasets: PreparedObjectContent["datasets"];
  controls: {
    datasets: PreparedObjectContent["datasets"] | null;
    settings: PreparedObjectContent["settings"];
  };
  files: readonly string[];
}
