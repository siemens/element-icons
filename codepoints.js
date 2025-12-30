import fs from 'fs';

const ICON_PATH = 'assets/icons';
const CODEPOINTS_PATH = 'assets/element-icon-codepoints.json';
const FIRST_CODEPOINT = 0xea01;
const CODEPOINT_KEY = '#nextCodepoint';

const icons = fs
  .readdirSync(ICON_PATH)
  .filter(i => i.endsWith('.svg'))
  .map(i => i.substring(0, i.length - 4))
  .sort();

const codepoints = fs.existsSync(CODEPOINTS_PATH)
  ? JSON.parse(fs.readFileSync(CODEPOINTS_PATH))
  : {
      '#comment': 'AUTO-GENERATED. Run `npm run codepoints` to update',
      [CODEPOINT_KEY]: FIRST_CODEPOINT
    };

for (const icon of icons) {
  if (!codepoints[icon]) {
    codepoints[icon] = codepoints[CODEPOINT_KEY]++;
  }
}

fs.writeFileSync(
  CODEPOINTS_PATH,
  JSON.stringify(codepoints, Object.keys(codepoints).sort(), 2) + '\n'
);
