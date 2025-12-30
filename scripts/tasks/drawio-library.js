import path from 'node:path';
import fs from 'node:fs/promises';
import { globby } from 'globby';
import { load as loadCheerio } from 'cheerio';
import { createZip } from '../lib/fs-utils.js';

const drawIoStyleTag = `\
  <style type="text/css">
    .icon{fill:#000000;}
  </style>\
`;

const drawIoHeader = `&lt;mxGraphModel&gt;&lt;root&gt;&lt;mxCell id="0"/&gt;&lt;mxCell id="1" parent="0"/&gt;&lt;mxCell id="2" value="" style="shape=image;editableCssRules=.*;aspect=fixed;image=data:image/svg+xml,`;
const drawIoFooter = `;" vertex="1" parent="1"&gt;&lt;mxGeometry width="150" height="150" as="geometry"/&gt;&lt;/mxCell&gt;&lt;/root&gt;&lt;/mxGraphModel&gt;`;

export default async function buildDrawIoLibraries({ paths, context }) {
  const metadataFiles = await globby('*.json', { cwd: paths.metadataSrc });
  if (!metadataFiles.length) {
    return;
  }

  const metadata = [];
  for (const file of metadataFiles) {
    const content = await fs.readFile(path.join(paths.metadataSrc, file), 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      metadata.push(...parsed);
    }
  }

  const metadataMap = new Map(metadata.map(item => [item.name, item]));
  const drawioItems = [];
  const categories = new Map();

  for (const entry of context.iconEntries) {
    const svgContent = await fs.readFile(entry.filePath, 'utf8');
    const $ = loadCheerio(svgContent, { xmlMode: true });
    $('svg').each((_, element) => {
      const $el = $(element);
      $el.prepend(drawIoStyleTag);
      $el.children('*').each((__, node) => {
        $(node).addClass('icon');
      });
    });
    const normalizedSvg = $('svg').toString();
    const base64 = Buffer.from(normalizedSvg).toString('base64');
    const item = createMxLibraryItem(base64, entry.prefixedName);
    const metadataEntry = metadataMap.get(entry.name);
    if (metadataEntry) {
      drawioItems.push(item);
      if (!categories.has(metadataEntry.category)) {
        categories.set(metadataEntry.category, []);
      }
      categories.get(metadataEntry.category).push(item);
    }
  }

  const filesWritten = [];
  const mainFile = 'siemens-element-icons.drawio';
  if (await writeDrawIoFile(mainFile, drawioItems, paths.drawIoDest)) {
    filesWritten.push(mainFile);
  }

  for (const [category, items] of categories.entries()) {
    const slug = category.toLocaleLowerCase();
    const filename = `siemens-element-icons-${slug}.drawio`;
    if (await writeDrawIoFile(filename, items, paths.drawIoDest)) {
      filesWritten.push(filename);
    }
  }

  if (!filesWritten.length) {
    return;
  }

  const zipPath = path.join(paths.drawIoDest, 'siemens-element-icons-drawio.zip');
  await createZip(
    zipPath,
    filesWritten.map(file => path.join(paths.drawIoDest, file))
  );

  await Promise.all(filesWritten.map(file => fs.rm(path.join(paths.drawIoDest, file))));
}

async function writeDrawIoFile(filename, items, dest) {
  if (!items.length) {
    return false;
  }
  const content = '<mxlibrary>' + JSON.stringify(items, null, 2) + '</mxlibrary>';
  await fs.writeFile(path.join(dest, filename), content);
  return true;
}

function createMxLibraryItem(base64Svg, title) {
  return {
    xml: drawIoHeader + base64Svg + drawIoFooter,
    w: 150,
    h: 150,
    aspect: 'fixed',
    title
  };
}
