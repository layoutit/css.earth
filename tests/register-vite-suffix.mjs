// `node --import ./tests/register-vite-suffix.mjs` installs the Vite suffix loader for a test run.
import { register } from 'node:module';
register('./vite-suffix-loader.mjs', import.meta.url);
