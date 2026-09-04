#!/usr/bin/env node

import { verifyEarthSourceManifest } from "./source-manifest.mjs";

console.log(JSON.stringify(await verifyEarthSourceManifest(), null, 2));
