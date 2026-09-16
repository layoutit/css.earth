import type { ImageLayer } from '../features/legacy-viewer/overlay-variants';

export interface AlignmentState {
  images: { id: string; label: string }[]; imageId: string; layer: ImageLayer; layers: ImageLayer[];
  densityOverlayEnabled: boolean; enabled: boolean; opacity: number; removalStrength: number;
  registrationNote: string; credit: string; sourcePageUrl: string; status: string;
  layerNote: string; statusDetail: string;
}
export interface LabPresentation {
  viewerHidden: boolean; cameraDisabled: boolean; referenceDisabled: boolean; toneDisabled: boolean;
  densityCamera: boolean; densityAdjustments: boolean; imageAdjustments: boolean;
  reconstructionImages: boolean; cloudAdjustments: boolean; cloudDensity: boolean;
  sourceUrl?: string; sourceCredit: string;
  status: { message: string; hidden: boolean; error: boolean };
}
export interface LabShellState {
  objectId: string; view: 'alignment' | 'reconstruction'; busy: boolean; alignmentAvailable: boolean;
  pose: string; alignment?: AlignmentState; presentation?: LabPresentation;
  originalOverlay?: { available: boolean; enabled: boolean; opacity: number; loading: boolean };
}

/** UI visibility/availability comes from workflow state, never from the current DOM. */
export function labPresentation(input: {
  busy: boolean; alignment: boolean; densityMode: boolean; densityAvailable: boolean;
  overlaysAvailable: boolean; referenceAvailable: boolean; observationInspection: boolean;
  cloudAvailable: boolean; reconstructionImages: boolean;
  sourceUrl?: string; sourceCredit: string; status: LabPresentation['status'];
}): LabPresentation {
  const density = input.alignment && input.densityMode && input.densityAvailable;
  return {
    viewerHidden: input.observationInspection,
    cameraDisabled: input.busy || input.densityMode && !input.densityAvailable,
    referenceDisabled: input.busy || (input.densityMode ? !input.densityAvailable : !input.referenceAvailable),
    toneDisabled: input.busy || !input.alignment || !input.densityMode,
    densityCamera: density || !input.alignment && input.referenceAvailable,
    densityAdjustments: density, imageAdjustments: density && input.overlaysAvailable,
    reconstructionImages: input.reconstructionImages,
    cloudAdjustments: input.reconstructionImages || input.cloudAvailable, cloudDensity: input.cloudAvailable,
    sourceUrl: input.sourceUrl, sourceCredit: input.sourceCredit, status: input.status,
  };
}
