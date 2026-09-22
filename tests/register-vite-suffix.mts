// `node --import ./tests/register-vite-suffix.mts` installs the Vite suffix loader for a test run.
import { register } from 'node:module';
register('./vite-suffix-loader.mts', import.meta.url);
