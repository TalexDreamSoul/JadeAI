#!/usr/bin/env node
import { spawn } from 'node:child_process';
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electron = require('electron');
const watch = process.argv.includes('--watch');
const targets = [
  { entry: 'electron/main/index.ts', output: 'out/main/index.js' },
  { entry: 'electron/preload/index.ts', output: 'out/preload/index.js' },
];
const options = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  sourcemap: true,
};

if (!watch) {
  await Promise.all(targets.map(({ entry, output }) => esbuild.build({ ...options, entryPoints: [entry], outfile: output })));
  process.exit(0);
}

let child = null;
let initialBuilds = 0;
let restarting = false;
const launch = () => {
  if (child) child.kill('SIGTERM');
  child = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, JADE_DEV_NODE_PATH: process.execPath },
  });
};
const contexts = await Promise.all(targets.map(({ entry, output }) => esbuild.context({
  ...options,
  entryPoints: [entry],
  outfile: output,
  plugins: [{ name: 'desktop-launcher', setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      if (initialBuilds < targets.length) {
        initialBuilds += 1;
        if (initialBuilds === targets.length) launch();
        return;
      }
      if (restarting) return;
      restarting = true;
      setTimeout(() => {
        restarting = false;
        launch();
      }, 75);
    });
  }}],
})));
await Promise.all(contexts.map((context) => context.watch()));
