import { describe, expect, it } from 'vitest';
import { createPolarSprite } from './polar.js';

describe('prepared polar sprites', () => {
    it('keeps the established density-map result when no native sampler is selected', () => {
        const map = new Uint8Array(16 * 8 * 4);
        for (let index = 0; index < map.length; index += 4)
            map.set([index / 4 % 251, 40, 80, 255], index);
        expect(createPolarSprite(map, 16, 8, 8, 4)).toEqual(createPolarSprite(map, 16, 8, 8, 4, { sampling: 'bilinear' }));
    });

    it('samples an opted-in high-frequency photograph before creating output-resolution coverage', () => {
        // A one-native-pixel red meridian is absent from this deliberately coarser delivered-map control.
        const deliveredControl = new Uint8Array(16 * 8 * 4);
        for (let index = 3; index < deliveredControl.length; index += 4) deliveredControl[index] = 255;
        const native = {
            sample(longitudeDegrees: number, latitudeDegrees: number, color: number[]) {
                if (Math.abs(latitudeDegrees) > 88) return false;
                color[0] = Math.abs(longitudeDegrees - 180) < 5 ? 255 : 0;
                color[1] = 0;
                color[2] = 0;
                return true;
            },
        };
        const fallback = createPolarSprite(deliveredControl, 16, 8, 32, 16);
        const direct = createPolarSprite(deliveredControl, 16, 8, 32, 16, {
            nativePhotograph: native,
            missingColor: () => [12, 34, 56],
        });
        expect(Math.max(...fallback.filter((_, index) => index % 4 === 0))).toBe(0);
        expect(Math.max(...direct.filter((_, index) => index % 4 === 0))).toBe(255);
        // A failed contributor gets the grid color at the polar output size, never a filtered source-map value.
        const center = (16 * (32 * 2) + 16) * 4;
        expect(Array.from(direct.slice(center, center + 3))).toEqual([12, 34, 56]);
    });

    it('retains native source opacity in a direct pole sample', () => {
        const map = new Uint8Array(8 * 4 * 4);
        const polar = createPolarSprite(map, 8, 4, 8, 4, {
            nativePhotograph: { sample(_longitudeDegrees, _latitudeDegrees, color) {
                color[0] = 80; color[1] = 120; color[2] = 160; color[3] = 128;
                return true;
            } },
            missingColor: () => [0, 0, 0],
        });
        expect(polar[(4 * 16 + 4) * 4 + 3]).toBe(128);
    });

    it('rejects native sampling for a nearest-valued surface', () => {
        const map = new Uint8Array(8 * 4 * 4);
        expect(() => createPolarSprite(map, 8, 4, 8, 4, { sampling: 'nearest', nativePhotograph: { sample: () => true },
            missingColor: () => [0, 0, 0] })).toThrow('cannot replace nearest');
    });
});
