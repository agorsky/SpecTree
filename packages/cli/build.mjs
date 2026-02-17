import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Externalize all deps EXCEPT @spectree/* (those get bundled inline)
const external = Object.keys(pkg.dependencies || {})
  .filter(dep => !dep.startsWith('@spectree/'));

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  external,
});
