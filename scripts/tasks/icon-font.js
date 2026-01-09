/**
 * Copyright (c) Siemens 2016 - 2026
 * SPDX-License-Identifier: MIT
 */
import path from 'node:path';

import fs from 'node:fs/promises';
import svgtofont from 'svgtofont';
import { ensureDir } from '../lib/fs-utils.js';

export default async function buildIconFont({ paths, context, fontName }) {
  await ensureDir(paths.fontDest);
  const codepointContent = await fs.readFile(paths.codepoints, 'utf8');
  const rawCodepoints = JSON.parse(codepointContent);
  const filteredEntries = Object.entries(rawCodepoints).filter(([key]) => !key.startsWith('#'));
  const codepointMap = new Map(filteredEntries);

  const originalIcons = context.iconEntries.filter(entry => entry.isOriginal);

  const glyphs = [...originalIcons]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => {
      const codepoint = codepointMap.get(entry.name);
      if (typeof codepoint !== 'number') {
        throw new Error(`Codepoint missing for "${entry.name}". Run \`npm run codepoints\`.`);
      }
      return {
        name: entry.name,
        prefixedName: entry.prefixedName,
        unicode: [String.fromCodePoint(codepoint)]
      };
    });

  context.codepoints = Object.fromEntries(codepointMap);
  context.glyphs = glyphs;

  const unicodeLookup = glyphs.reduce((acc, glyph) => {
    acc.set(glyph.prefixedName, glyph.unicode[0]);
    return acc;
  }, new Map());

  await fs.rm(paths.fontSrcTemp, { recursive: true, force: true });
  await ensureDir(paths.fontSrcTemp);
  for (const entry of originalIcons) {
    const tempPath = path.join(paths.fontSrcTemp, path.basename(entry.filePath));
    await fs.copyFile(entry.filePath, tempPath);
  }

  await svgtofont({
    src: paths.fontSrcTemp,
    dist: paths.fontDest,
    fontName,
    css: false,
    svgicons2svgfont: {
      fontHeight: 1024,
      normalize: true,
      metadata: context.metaData
    },
    getIconUnicode(name) {
      const unicode = unicodeLookup.get(name);
      if (!unicode) {
        throw new Error(`Unicode missing for glyph ${name}`);
      }
      return [unicode];
    }
  });

  await fs.rm(paths.fontSrcTemp, { recursive: true, force: true });
  const obsoleteFiles = [
    path.join(paths.fontDest, `${fontName}.svg`),
    path.join(paths.fontDest, `${fontName}.eot`),
    path.join(paths.fontDest, `${fontName}.symbol.svg`)
  ];
  await Promise.all(obsoleteFiles.map(file => fs.rm(file, { force: true })));
}
