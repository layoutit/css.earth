import catalog from './prepared-spacecraft.json' with { type: 'json' };
interface MissionImage { src: string; width: number; height: number; sourceUrl: string; credit: string; kind?: string; }
export interface Mission {
  id: string; name: string; description: string; descriptionSourceUrl?: string; sourceUrl: string;
  facts: readonly { label: string; value: string; detail?: string }[]; image: MissionImage; emblem?: MissionImage;
}
// The generated catalog remains data; its consumers check the full displayed shape.
export const SPACECRAFT: Readonly<Record<string, Mission>> = catalog;
