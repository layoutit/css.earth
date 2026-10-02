import { type CloudPart } from '@cssearth/objects';
export interface CloudSelection { contextId: string; enabledIds: string[]; }
export interface CloudBrightness { overall: number; x: number; y: number; z: number; }
export interface CloudStarOptions { enabled: boolean; brightness: number; size: number; }
export interface CloudStarContext { id: string; count: number; sourceUrl: string; }
export interface CloudContext {
  id: string;
  parts: CloudPart[];
  selection?: CloudSelection | readonly string[];
}
