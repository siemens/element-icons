import writerOpts from './tools/semantic-release/writer-opts.js';
import { commitTypes, releaseRules } from './tools/semantic-release/config.js';

const skipCommits = process.env.SKIP_COMMIT === 'true';

export default {
  branches: [
    {
      name: 'release/+([0-9])?(.{+([0-9]),x}).x',
      range: "${name.replace(/^release\\//g, '')}",
      channel: "${name.replace(/^release\\//g, '')}"
    },
    'main',
    {
      name: 'next',
      channel: 'next',
      prerelease: 'rc'
    }
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules,
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE']
        },
        presetConfig: {
          types: commitTypes
        }
      }
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'angular',
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE', 'NOTE', 'DEPRECATED']
        },
        writerOpts
      }
    ],
    ...(skipCommits ? [] : ['@semantic-release/changelog']),
    ['@semantic-release/npm'],
    ...(skipCommits
      ? []
      : [
          [
            '@semantic-release/git',
            {
              assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
              message: 'chore(release): ${nextRelease.version}'
            }
          ]
        ]),
    [
      '@semantic-release/github',
      {
        successComment: false
      }
    ]
  ]
};
