export interface ShapeCloudComponent {
  id: string; label: string; memberIds: string[]; groupId: string;
  shape: 'shell' | 'ring' | 'ellipsoid'; operation: 'add' | 'subtract';
  x: number; y: number; radiusX: number; radiusY: number; rotationDegrees: number;
  /** Clockwise image-local ring sector. Omitted values preserve a complete ring. */
  arcCenterDegrees?: number; arcSweepDegrees?: number;
  weight: number; thickness: number; softness: number; depth: number; enabled: boolean;
}
export interface ShapeCloudSettings { components: ShapeCloudComponent[]; exposure: number }
