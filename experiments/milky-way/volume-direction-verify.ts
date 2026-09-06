import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { VolumeControls, VolumeVector } from './volume-controls.js';

interface MilkyWayWindow {
  readonly polycssMilkyWay: {
    readonly controls: VolumeControls;
    project(point: VolumeVector): readonly [number, number, number];
  };
}

type DirectionReceipt = {
  readonly hemisphere: 'above' | 'below';
  readonly yawRadians: number;
  readonly landmark: VolumeVector;
  readonly horizontalPixels: number;
  readonly verticalPixels: number;
};

const output = resolve('.local/milky-way-proof/volume');
const reportPath = resolve(output, 'verification', 'direction.json');
const yaws = [0, 0.8, 1.6];
const pitches: readonly ['above' | 'below', number][] = [['above', 1], ['below', -1]];
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
  await page.waitForSelector('body[data-ready=true]');
  const receipts: DirectionReceipt[] = [];

  for (const [hemisphere, pitchRadians] of pitches) for (const yawRadians of yaws) {
    const landmark = await page.evaluate(({ yawRadians, pitchRadians }) => {
      const controls = (window as unknown as MilkyWayWindow).polycssMilkyWay.controls;
      controls.setCamera({ yawRadians, pitchRadians, distance: 30, target: [0, 0, 0] });
      const back = controls.camera().back;
      // A source-axis landmark on the camera-facing half of the fixed galaxy.
      return Math.abs(back[0]) >= Math.abs(back[1])
        ? [Math.sign(back[0]) * 10, 0, 0]
        : [0, Math.sign(back[1]) * 10, 0];
    }, { yawRadians, pitchRadians }) as VolumeVector;

    const horizontalBefore = await project(page, landmark);
    await drag(page, 640, 450, 700, 450);
    const horizontalAfter = await project(page, landmark);
    const horizontalPixels = horizontalAfter[0] - horizontalBefore[0];

    await page.evaluate(({ yawRadians, pitchRadians }) => {
      window.polycssMilkyWay.controls.setCamera({ yawRadians, pitchRadians, distance: 30, target: [0, 0, 0] });
    }, { yawRadians, pitchRadians });
    const verticalBefore = await project(page, landmark);
    await drag(page, 640, 450, 640, 510);
    const verticalAfter = await project(page, landmark);
    const verticalPixels = verticalAfter[1] - verticalBefore[1];
    receipts.push({ hemisphere, yawRadians, landmark, horizontalPixels, verticalPixels });
  }

  const horizontalFailures = receipts.filter(receipt => receipt.horizontalPixels <= 4);
  const verticalFailures = receipts.filter(receipt => receipt.verticalPixels <= 4);
  const report = {
    passed: horizontalFailures.length === 0 && verticalFailures.length === 0 && errors.length === 0,
    contract: 'A camera-facing fixed X/Y galaxy landmark follows a pure drag in the corresponding screen axis.',
    receipts,
    failures: { horizontal: horizontalFailures, vertical: verticalFailures, pageErrors: errors },
  };
  await mkdir(resolve(output, 'verification'), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  assert.deepEqual(errors, [], 'Directional proof has browser errors.');
  assert.deepEqual(horizontalFailures, [], 'Horizontal observer-yaw direction regressed.');
  assert.deepEqual(verticalFailures, [], `Vertical pointer direction is reversed; inspect ${reportPath}.`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}

async function project(page: import('playwright').Page, landmark: VolumeVector): Promise<readonly [number, number, number]> {
  return page.evaluate(point => (window as unknown as MilkyWayWindow).polycssMilkyWay.project(point as VolumeVector), landmark);
}

async function drag(page: import('playwright').Page, fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 6 });
  await page.mouse.up();
}
