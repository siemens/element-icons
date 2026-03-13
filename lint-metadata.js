/**
 * Copyright (c) Siemens 2016 - 2026
 * SPDX-License-Identifier: MIT
 */
import fs from 'fs';
import path from 'path';

const ICON_PATH = 'assets/icons';
const METADATA_PATH = 'src/element-icon-metadata.json';
const fix = process.argv.includes('--fix');

function readIconsFromFs() {
  return fs
    .readdirSync(ICON_PATH)
    .filter(f => f.endsWith('.svg'))
    .map(f => f.slice(0, -4));
}

function readMetadata() {
  return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
}

/**
 * Validates that every icon referenced in metadata has a corresponding SVG file.
 * Fix: removes stale metadata entries.
 * @returns {object[]} updated metadata
 */
function validateMetadataIconsExistInFs(icons, metadata) {
  const iconSet = new Set(icons);
  const missing = metadata.map(m => m.name).filter(name => !iconSet.has(name));
  if (missing.length === 0) return metadata;

  if (fix) {
    console.log(
      `Fixing: removing ${missing.length} metadata entr${missing.length === 1 ? 'y' : 'ies'} for non-existent icon${missing.length === 1 ? '' : 's'}: "${missing.join('", "')}"`
    );
    const missingSet = new Set(missing);
    return metadata.filter(m => !missingSet.has(m.name));
  }

  console.error(
    `Icons "${missing.join('", "')}" are referenced in metadata but don't exist in the file system.`
  );
  process.exit(1);
}

/**
 * Validates that every SVG file in the icons directory has a metadata entry.
 * Fix: deletes orphaned SVG files.
 * @returns {string[]} updated icons list
 */
function validateFsIconsExistInMetadata(icons, metadata) {
  const metadataNames = new Set(metadata.map(m => m.name));
  const orphaned = icons.filter(name => !metadataNames.has(name));
  if (orphaned.length === 0) return icons;

  if (fix) {
    console.log(
      `Fixing: deleting ${orphaned.length} icon file${orphaned.length === 1 ? '' : 's'} with no metadata entry: "${orphaned.join('", "')}"`
    );
    for (const name of orphaned) {
      fs.rmSync(path.join(ICON_PATH, `${name}.svg`));
    }
    const orphanedSet = new Set(orphaned);
    return icons.filter(name => !orphanedSet.has(name));
  }

  console.error(
    `Icons "${orphaned.join('", "')}" exist in the file system but have no metadata entry.`
  );
  process.exit(1);
}

/**
 * Validates that no icon is flagged as innerSource.
 * Fix: removes innerSource metadata entries and deletes their SVG files.
 * @returns {object[]} updated metadata
 */
function validateNoInnerSourceIcons(icons, metadata) {
  const innerSource = metadata.filter(m => m.innerSource);
  if (innerSource.length === 0) return metadata;

  const names = innerSource.map(m => m.name);

  if (fix) {
    console.log(
      `Fixing: removing ${innerSource.length} inner-source icon${innerSource.length === 1 ? '' : 's'}: "${names.join('", "')}"`
    );
    const iconSet = new Set(icons);
    for (const name of names) {
      if (iconSet.has(name)) {
        fs.rmSync(path.join(ICON_PATH, `${name}.svg`));
      }
    }
    return metadata.filter(m => !m.innerSource);
  }

  console.error(
    `Icons "${names.join('", "')}" are flagged as inner-source and must not be included.`
  );
  process.exit(1);
}

let icons = readIconsFromFs();
let metadata = readMetadata();

metadata = validateMetadataIconsExistInFs(icons, metadata);
icons = validateFsIconsExistInMetadata(icons, metadata);
metadata = validateNoInnerSourceIcons(icons, metadata);

if (fix) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata));
}
