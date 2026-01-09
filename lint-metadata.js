/**
 * Copyright (c) Siemens 2016 - 2026
 * SPDX-License-Identifier: MIT
 */
import fs from 'fs';

const ICON_PATH = 'assets/icons';
const METADATA_PATH = 'src/element-icon-metadata.json';

const icons = fs
  .readdirSync(ICON_PATH)
  .filter(i => i.endsWith('.svg'))
  .map(i => i.substring(0, i.length - 4));
const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8')).map(m => m.name);

const missingFiles = metadata.filter(icon => !icons.includes(icon));
if (missingFiles.length > 0) {
  console.error(`Icons "${missingFiles.join('", "')}" are referenced but don't exist.`);
  process.exit(1);
}

const missingReferences = icons.filter(icon => !metadata.includes(icon));
if (missingReferences.length > 0) {
  console.error(`Icons "${missingReferences.join('", "')}" exist but are never referenced.`);
  process.exit(1);
}
