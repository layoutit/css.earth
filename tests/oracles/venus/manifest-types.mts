import type { captureGoogleMapsReference, importGoogleMapsReference, captureCssEarthBrowser } from "./capture.mts";
export type ReferenceManifest = Awaited<ReturnType<typeof captureGoogleMapsReference>>["manifest"] | Awaited<ReturnType<typeof importGoogleMapsReference>>["manifest"];
export type BrowserManifest = Awaited<ReturnType<typeof captureCssEarthBrowser>>["manifest"];
