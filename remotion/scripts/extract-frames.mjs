#!/usr/bin/env node
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const FPS = 30;
const OUT_DIR = join(process.cwd(), 'public', 'medspa-frames');
const INTERVAL = 60; // frames = 2 seconds at 30fps

mkdirSync(OUT_DIR, { recursive: true });

// Extract frames at 0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840
for (let frame = 0; frame < 900; frame += INTERVAL) {
  const padded = String(Math.floor(frame / INTERVAL) + 1).padStart(2, '0');
  const outPath = join(OUT_DIR, `frame_${padded}.png`);
  const cmd = `npx remotion render src/index.ts FrameExtractor "${outPath}" --frames=0 --codec=png --props='{"sourceFrame":${frame}}'`;
  console.log(`Extracting frame ${frame} (${(frame / FPS).toFixed(1)}s) -> ${outPath}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  } catch (e) {
    console.error(`Failed at frame ${frame}:`, e.message);
    process.exit(1);
  }
}

console.log('Done. Frames in:', OUT_DIR);
