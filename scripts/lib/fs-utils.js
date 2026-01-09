/**
 * Copyright (c) Siemens 2016 - 2026
 * SPDX-License-Identifier: MIT
 */
import path from 'node:path';

import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function createZip(zipPath, files) {
  await ensureDir(path.dirname(zipPath));
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(zipPath);

  const finalized = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(output);
  for (const file of files) {
    const name = path.basename(file);
    archive.file(file, { name });
  }
  archive.finalize();
  await finalized;
}

export async function createZipFromDist(zipPath, distRoot, ignorePatterns = []) {
  await ensureDir(path.dirname(zipPath));
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(zipPath);

  const finalized = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(output);
  archive.glob('**/*', {
    cwd: distRoot,
    dot: false,
    ignore: ignorePatterns
  });
  archive.finalize();
  await finalized;
}
