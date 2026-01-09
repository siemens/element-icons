/**
 * Copyright (c) Siemens 2016 - 2026
 * SPDX-License-Identifier: MIT
 */
import eslintPluginHeaders from 'eslint-plugin-headers';

import { defineConfig } from 'eslint/config';

const headerContent = 'Copyright (c) Siemens 2016 - 2026\nSPDX-License-Identifier: MIT';

export default defineConfig([
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'assets/**/*.json',
      'assets/**/*.svg',
      'templates/**',
      'siemens-element-icons-*.tgz'
    ]
  },
  {
    files: ['**/*.js', '**/*.ts'],
    plugins: {
      headers: eslintPluginHeaders
    },
    rules: {
      'headers/header-format': [
        'error',
        {
          source: 'string',
          content: headerContent
        }
      ]
    }
  }
]);
