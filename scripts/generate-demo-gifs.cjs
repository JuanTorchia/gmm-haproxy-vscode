#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const imageDir = path.join(repoRoot, 'docs', 'images');

const demos = [
  {
    output: '02-completion.gif',
    delay: 140,
    frames: [
      '02-completion-ba.png',
      '02-completion-balance.png',
      '02-completion-http.png',
    ],
  },
  {
    output: '03-validation.gif',
    delay: 140,
    frames: [
      '03-validation-error.png',
      '03-validation-warning.png',
      '03-validation-warning-backend.png',
    ],
  },
  {
    output: '04-hover.gif',
    delay: 120,
    frames: [
      '04-hover-balance.png',
      '04-hover-http-request.png',
      '04-hover-httpchk.png',
      '04-hover-stick-table.png',
      '04-hover-timeout.png',
    ],
  },
  {
    output: '09-undefined-backend.gif',
    delay: 160,
    frames: [
      '09-undefined-backend.png',
    ],
  },
];

function requireMagick() {
  const result = spawnSync('magick', ['-version'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(
      'ImageMagick is required to generate demo GIFs. Install it from https://imagemagick.org before running this script.',
    );
  }
}

function requireFrames(demo) {
  const missingFrames = demo.frames.filter((frame) => {
    return !fs.existsSync(path.join(imageDir, frame));
  });

  if (missingFrames.length > 0) {
    throw new Error(`Missing source frame(s) for ${demo.output}: ${missingFrames.join(', ')}`);
  }
}

function generateGif(demo) {
  const outputPath = path.join(imageDir, demo.output);
  const framePaths = demo.frames.map((frame) => path.join(imageDir, frame));
  const args = [
    '-delay',
    String(demo.delay),
    '-loop',
    '0',
    '-dispose',
    'Background',
    ...framePaths,
    '-layers',
    'Optimize',
    outputPath,
  ];

  const result = spawnSync('magick', args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(`Failed to generate ${demo.output}:\n${result.stderr || result.stdout}`);
  }

  const sizeInKb = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`Generated docs/images/${demo.output} (${sizeInKb} KB)`);
}

function main() {
  requireMagick();

  for (const demo of demos) {
    requireFrames(demo);
    generateGif(demo);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
