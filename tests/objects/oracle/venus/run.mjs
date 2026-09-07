import { resolve } from "node:path";

import {
  captureCssEarthBrowser,
  captureGoogleMapsReference,
  importGoogleMapsReference,
} from "./capture.mjs";
import { compareOracleCaptures } from "./compare.mjs";
import { GOOGLE_MAPS_VENUS_URL } from "./profile.mjs";

const options = parseArguments(process.argv.slice(2));
const outputRoot = resolve(options.outputRoot ??
  `output/playwright/venus-google-maps-oracle-${timestampSlug()}`);
const baseUrl = new URL(options.baseUrl ?? "http://127.0.0.1:4210");
const browserChannel = options.browserChannel ??
  process.env.PLAYWRIGHT_CHANNEL ?? "chrome";

process.stdout.write(`${JSON.stringify({
  phase: "capture-reference",
  canonicalUrl: GOOGLE_MAPS_VENUS_URL,
  outputRoot,
}, null, 2)}\n`);
const reference = options.referenceInput
  ? await importGoogleMapsReference({
    inputManifestPath: resolve(options.referenceInput),
    outputRoot,
  })
  : await captureGoogleMapsReference({
    outputRoot,
    browserChannel,
  });

process.stdout.write(`${JSON.stringify({
  phase: "capture-browser",
  route: new URL("/venus/", baseUrl).href,
}, null, 2)}\n`);
const browser = await captureCssEarthBrowser({
  outputRoot,
  baseUrl,
  referenceManifest: reference.manifest,
  browserChannel,
});

process.stdout.write(`${JSON.stringify({ phase: "compare" }, null, 2)}\n`);
const comparison = await compareOracleCaptures({
  outputRoot,
  referenceManifest: reference.manifest,
  browserManifest: browser.manifest,
});

process.stdout.write(`${JSON.stringify({
  ok: true,
  oracleValid: comparison.report.oracleValid,
  parityQualified: comparison.report.parityQualified,
  presentationScoreQualified: comparison.report.presentationScoreQualified,
  presentationScorePercent: comparison.report.presentationScorePercent,
  diagnosticScoreWithAvailableEvidencePercent:
    comparison.report.diagnosticScoreWithAvailableEvidencePercent,
  coverageFailures: comparison.report.coverageFailures,
  componentWeights: comparison.report.componentWeights,
  componentScoreSummary: comparison.report.componentScoreSummary,
  qualification: comparison.report.qualification,
  outputRoot,
  report: comparison.reportPath,
  isolatedTriptychs: comparison.report.poses.map((pose) => ({
    id: pose.id,
    starfield: pose.independentCaptures?.starfield.triptych.path ?? null,
    sun: pose.independentCaptures?.sun.triptych.path ?? null,
  })),
  componentScores: comparison.report.poses.map((pose) => ({
    id: pose.id,
    endpointQualification: pose.endpointQualification,
    diagnosticComponentWeightedScorePercent:
      pose.diagnosticComponentWeightedScorePercent,
    components: pose.componentScores && Object.fromEntries(
      Object.entries(pose.componentScores).map(([id, score]) => [id, {
        scorePercent: score.scorePercent,
        qualified: score.qualified,
      }]),
    ),
  })),
}, null, 2)}\n`);

function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--") {
      continue;
    } else if (argument === "--base-url") {
      options.baseUrl = requiredValue(argumentsList, ++index, argument);
    } else if (argument === "--out") {
      options.outputRoot = requiredValue(argumentsList, ++index, argument);
    } else if (argument === "--browser-channel") {
      options.browserChannel = requiredValue(argumentsList, ++index, argument);
    } else if (argument === "--reference-input") {
      options.referenceInput = requiredValue(argumentsList, ++index, argument);
    } else {
      throw new TypeError(
        "Usage: pnpm oracle:venus -- [--base-url URL] [--out PATH] " +
        "[--browser-channel chrome] [--reference-input PATH]",
      );
    }
  }
  return options;
}

function requiredValue(argumentsList, index, flag) {
  const value = argumentsList[index];
  if (!value || value.startsWith("--")) {
    throw new TypeError(`${flag} requires a value.`);
  }
  return value;
}

function timestampSlug() {
  return new Date().toISOString().replaceAll(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}
