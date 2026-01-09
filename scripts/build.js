/**
 * Copyright (c) Siemens 2016 - 2026
 * SPDX-License-Identifier: MIT
 */
import path from 'node:path';

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { globby } from 'globby';
import { optimize as optimizeSvg } from 'svgo';
import { transform as transformCss } from 'esbuild';
import { load as loadSvg } from 'cheerio';
import _ from 'lodash';
import buildIconFont from './tasks/icon-font.js';
import buildDrawIoLibraries from './tasks/drawio-library.js';
import { ensureDir, createZipFromDist } from './lib/fs-utils.js';
import * as sass from 'sass';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const FONT_NAME = 'siemens-element-icons';
const CLASS_NAME = 'element';
const FONT_PATH = '../fonts/';

const paths = {
  dist: path.join(rootDir, 'dist'),
  codepoints: path.join(rootDir, 'assets', 'element-icon-codepoints.json'),
  metadataSrc: path.join(rootDir, 'src'),
  metadataDest: path.join(rootDir, 'dist'),
  iconSrc: path.join(rootDir, 'assets', 'icons'),
  iconDest: path.join(rootDir, 'dist', 'icons'),
  fontDest: path.join(rootDir, 'dist', 'fonts'),
  fontSrcTemp: path.join(rootDir, 'dist', '.font-src'),
  styleDest: path.join(rootDir, 'dist', 'style'),
  downloadDest: path.join(rootDir, 'dist'),
  drawIoDest: path.join(rootDir, 'dist'),
  templates: path.join(rootDir, 'templates')
};

const svgoConfig = {
  multipass: true,
  js2svg: {
    pretty: false
  },
  plugins: [
    {
      name: 'preset-default'
    },
    { name: 'removeViewBox', active: false },
    'removeDimensions'
  ]
};

const context = {
  iconEntries: [],
  glyphs: [],
  codepoints: {},
  metaData: ''
};

const tasks = [
  ['clean dist', cleanDist],
  ['copy metadata', copyMetadata],
  ['prepare svg icons', prepareIcons],
  ['build font files', () => buildIconFont({ paths, context, fontName: FONT_NAME })],
  ['render templates', renderTemplates],
  ['compile scss bundles', compileScssBundles],
  ['generate JS icon exports', buildIconExports],
  ['minify css bundles', minifyCssBundles],
  ['build draw.io library', () => buildDrawIoLibraries({ paths, context })],
  ['package distribution', packageArtifacts]
];

async function main() {
  try {
    console.log('Starting build pipeline');
    context.metaData = await resolveMetaDataString();

    for (const [label, task] of tasks) {
      console.log(`→ ${label}`);
      await task();
    }

    console.log('✔ Build finished successfully');
    process.exit(0);
  } catch (error) {
    console.error('✖ Build failed');
    console.error(error);
    process.exit(1);
  }
}

async function resolveMetaDataString() {
  const pkgJson = await fs.readFile(path.join(rootDir, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgJson);
  const commit = process.env.CI_COMMIT_SHA || 'DIRTY';
  return `© Siemens - ${pkg.version} - ${commit.substring(0, 8)}`;
}

async function cleanDist() {
  await fs.rm(paths.dist, { recursive: true, force: true });
  await ensureDir(paths.dist);
}

async function copyMetadata() {
  await ensureDir(paths.metadataDest);
  const files = await globby('*.json', { cwd: paths.metadataSrc });
  await Promise.all(
    files.map(async file => {
      const src = path.join(paths.metadataSrc, file);
      const dest = path.join(paths.metadataDest, file);
      const raw = await fs.readFile(src, 'utf8');
      const parsed = JSON.parse(raw);
      const formatted = JSON.stringify(parsed, null, 2) + '\n';
      await fs.writeFile(dest, formatted);
    })
  );
}

async function prepareIcons() {
  await ensureDir(paths.iconDest);
  const iconFiles = await globby('*.svg', { cwd: paths.iconSrc, dot: false });
  const iconNames = new Set();

  for (const file of iconFiles) {
    const srcPath = path.join(paths.iconSrc, file);
    const nameWithoutExt = file.replace(/\.svg$/i, '');
    const prefixedName = `element-${nameWithoutExt}`;
    const destName = `${prefixedName}.svg`;
    const destPath = path.join(paths.iconDest, destName);
    const svgSource = await fs.readFile(srcPath, 'utf8');
    const optimized = optimizeSvg(svgSource, svgoConfig).data;
    await fs.writeFile(destPath, optimized);
    iconNames.add(prefixedName);
    context.iconEntries.push({
      name: nameWithoutExt,
      prefixedName,
      filePath: destPath,
      isOriginal: true
    });
  }

  const duplicates = [];
  for (const entry of context.iconEntries) {
    if (entry.prefixedName.endsWith('-filled')) {
      continue;
    }
    const filledName = `${entry.prefixedName}-filled`;
    if (iconNames.has(filledName)) {
      continue;
    }
    const filledFile = `${filledName}.svg`;
    const destPath = path.join(paths.iconDest, filledFile);
    await fs.copyFile(entry.filePath, destPath);
    iconNames.add(filledName);
    duplicates.push({
      name: `${entry.name}-filled`,
      prefixedName: filledName,
      filePath: destPath,
      isOriginal: false
    });
  }

  context.iconEntries.push(...duplicates);
}

async function renderTemplates() {
  await ensureDir(paths.styleDest);
  const templateData = {
    glyphs: context.glyphs,
    fontName: FONT_NAME,
    className: CLASS_NAME,
    fontPath: FONT_PATH,
    metaData: context.metaData,
    _: _
  };

  const templateFiles = [
    { src: 'icons.scss', dest: path.join(paths.styleDest, `${FONT_NAME}.scss`) },
    { src: 'variables.scss', dest: path.join(paths.styleDest, 'variables.scss') },
    { src: 'index.html', dest: path.join(paths.dist, 'index.html') }
  ];

  await Promise.all(
    templateFiles.map(async file => {
      const templatePath = path.join(paths.templates, file.src);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const compiled = _.template(templateContent);
      const rendered = compiled(templateData);
      await fs.writeFile(file.dest, rendered);
    })
  );
}

async function compileScssBundles() {
  const entryPath = path.join(paths.styleDest, `${FONT_NAME}.scss`);
  const cssPath = entryPath.replace(/\.scss$/i, '.css');
  const { css } = sass.compile(entryPath, {
    style: 'expanded',
    loadPaths: [paths.styleDest]
  });
  await fs.writeFile(cssPath, `${css.trimEnd()}\n`);
}

async function buildIconExports() {
  const files = await globby('*.svg', { cwd: paths.iconDest });
  const entries = [];

  for (const file of files) {
    const iconPath = path.join(paths.iconDest, file);
    const svgContent = await fs.readFile(iconPath, 'utf8');
    const $ = loadSvg(svgContent, { xmlMode: true });
    const svg = $('svg').first();
    if (!svg.length) {
      continue;
    }
    const componentName = transformComponentName(file.replace(/\.svg$/i, ''));
    const svgMarkup = $.xml(svg).replace(/"/g, "'");
    entries.push({ componentName, svg: svgMarkup });
  }

  entries.sort((a, b) => a.componentName.localeCompare(b.componentName));
  const indexMjs = entries
    .map(entry => `export const ${entry.componentName} = "data:image/svg+xml;utf8,${entry.svg}";`)
    .join('\n');
  const indexDts = entries
    .map(entry => `export declare const ${entry.componentName}: string;`)
    .join('\n');

  await fs.writeFile(path.join(paths.dist, 'index.mjs'), indexMjs + '\n');
  await fs.writeFile(path.join(paths.dist, 'index.d.ts'), indexDts + '\n');
}

async function minifyCssBundles() {
  const cssFiles = await globby(['*.css', '!*.min.css'], { cwd: paths.styleDest });
  await Promise.all(
    cssFiles.map(async file => {
      const filePath = path.join(paths.styleDest, file);
      const cssContent = await fs.readFile(filePath, 'utf8');
      const { code } = await transformCss(cssContent, {
        loader: 'css',
        minify: true,
        legalComments: 'none',
        sourcefile: file
      });
      const minPath = filePath.replace(/\.css$/i, '.min.css');
      await fs.writeFile(minPath, code);
    })
  );
}

async function packageArtifacts() {
  const zipPath = path.join(paths.downloadDest, 'siemens-element-icons.zip');
  await createZipFromDist(zipPath, paths.dist, ['**/*.zip', '**/*.drawio']);
}

function camelCase(text) {
  return text
    .replace(/[^A-Z0-9]+([A-Z0-9])?/gi, (match, chr) => (chr == null ? '' : chr.toUpperCase()))
    .replace(/^[a-z]/, chr => chr.toLowerCase());
}

function transformComponentName(filename) {
  const basename = path.basename(filename, path.extname(filename));
  return camelCase(basename).replace(/^[0-9]/, char => `_${char}`);
}

main();
