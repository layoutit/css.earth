/** Numeric coordinates retain their source precision; preparation validates dimensions. */
export type Vector2 = readonly number[];
export type Vector3 = readonly number[];
export type Matrix3 = readonly number[];
export type Matrix4 = readonly number[];
export interface VisibleRect { left: number; top: number; right: number; bottom: number; }
export interface Matrix3dLike { m11:number;m12:number;m13:number;m21:number;m22:number;m23:number;m31:number;m32:number;m33:number; }
