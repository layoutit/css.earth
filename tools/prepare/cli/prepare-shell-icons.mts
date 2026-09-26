#!/usr/bin/env node
// Entry script: `pnpm prepare:shell-assets`. The work is in ../prepare-shell-icons.mts.
import { prepareShellIcons } from '../prepare-shell-icons.mts';

await prepareShellIcons();
