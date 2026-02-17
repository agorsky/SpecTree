import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

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

// Write a clean package.json to dist/ for publishing
// Removes workspace:* deps (bundled inline by esbuild)
const publishPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  type: pkg.type,
  bin: { spectree: './index.js' },
  main: './index.js',
  repository: pkg.repository,
  publishConfig: pkg.publishConfig,
  dependencies: Object.fromEntries(
    Object.entries(pkg.dependencies || {})
      .filter(([dep]) => !dep.startsWith('@spectree/'))
  ),
};

mkdirSync('dist', { recursive: true });
writeFileSync('dist/package.json', JSON.stringify(publishPkg, null, 2) + '\n');
