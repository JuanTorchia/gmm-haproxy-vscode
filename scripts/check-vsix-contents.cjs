#!/usr/bin/env node

const { execFileSync, execSync } = require('node:child_process');
const { statSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

// The intended package shape. Entries ending in `/` allow any file below that
// directory; every other entry must match a packaged path exactly. Anything
// outside this list is a packaging regression, not a candidate for review.
const allowedEntries = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'ROADMAP.md',
  'SECURITY.md',
  'SUPPORT.md',
  'GOOD_FIRST_ISSUES.md',
  'language-configuration.json',
  'images/',
  'syntaxes/',
  'snippets/',
  'client/package.json',
  'client/out/extension.js',
  'server/package.json',
  'server/out/server.js',
];

// Ceilings set from the clean package (17 files, ~1.65 MiB unpacked). Raising
// either one must be a deliberate change in the same PR that grows the package.
const maxFileCount = 17;
const maxTotalBytes = 2 * 1024 * 1024;

// Keep this list intentionally conservative. If a file matches one of these
// patterns, publishing should stop until `.vscodeignore` excludes it.
const forbiddenPatterns = [
  /\.env(?:\.|$)/i,
  /service-?account.*\.json$/i,
  /serviceaccout\.json$/i,
  /credentials\.json$/i,
  /firebase-adminsdk.*\.json$/i,
  /google-application-credentials.*\.json$/i,
  /\.(?:pem|key|p12|pfx|crt|cer)$/i,
  /(?:^|\/)node_modules\//i,
  /(?:^|\/)coverage\//i,
  /(?:^|\/)test\//i,
  /\.test\.(?:ts|js)$/i,
  /\.map$/i,
  /\.vsix$/i,
  /\.tsbuildinfo$/i,
];

// `vsce ls` prints the same file list that maintainers inspect before
// publishing. Parsing this output keeps the guard aligned with the actual
// package contents instead of guessing from git status.
//
// `--no-dependencies` is required, and must match how ci.yml and publish.yml
// invoke `vsce package`. Without it vsce tries to resolve the dependency tree,
// prints nothing usable to stdout, and the guard silently inspects zero files
// and reports success — which is what it did until this was caught.
function listPackageContents() {
  if (process.platform === 'win32') {
    return execSync('npm exec -- vsce ls --no-dependencies', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  return execFileSync('npm', ['exec', '--', 'vsce', 'ls', '--no-dependencies'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function extractFilePaths(vsceTreeOutput) {
  return vsceTreeOutput
    .split(/\r?\n/)
    .filter((line) => !/^[^\s│├└─].*\.vsix$/.test(line.trim()))
    .map((line) => line.replace(/^[\s│├└─]+/, '').replace(/\s+\[[^\]]+\]$/, '').trim())
    .filter((line) => line.length > 0 && !line.endsWith('/'));
}

function findForbiddenFiles(filePaths) {
  return filePaths.filter((filePath) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return forbiddenPatterns.some((pattern) => pattern.test(normalizedPath));
  });
}

function isAllowed(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return allowedEntries.some((entry) =>
    entry.endsWith('/') ? normalizedPath.startsWith(entry) : normalizedPath === entry,
  );
}

function totalSizeInBytes(filePaths) {
  return filePaths.reduce((sum, filePath) => sum + statSync(path.join(repoRoot, filePath)).size, 0);
}

function findShapeProblems(filePaths) {
  const problems = filePaths
    .filter((filePath) => !isAllowed(filePath))
    .map((filePath) => `not in the package allowlist: ${filePath}`);

  if (filePaths.length > maxFileCount) {
    problems.push(`package has ${filePaths.length} files, ceiling is ${maxFileCount}`);
  }

  const totalBytes = totalSizeInBytes(filePaths);
  if (totalBytes > maxTotalBytes) {
    problems.push(`package is ${totalBytes} bytes unpacked, ceiling is ${maxTotalBytes}`);
  }

  return problems;
}

function failWith(heading, items, hint) {
  console.error(heading);
  for (const item of items) {
    console.error(`- ${item}`);
  }
  console.error(hint);
  process.exit(1);
}

function main() {
  const packageContents = listPackageContents();
  const filePaths = extractFilePaths(packageContents);
  const forbiddenFiles = findForbiddenFiles(filePaths);

  if (forbiddenFiles.length > 0) {
    failWith(
      'Forbidden files were found in the VS Code extension package:',
      forbiddenFiles,
      'Update .vscodeignore before publishing.',
    );
  }

  const shapeProblems = findShapeProblems(filePaths);
  if (shapeProblems.length > 0) {
    failWith(
      'The VS Code extension package does not match its intended shape:',
      shapeProblems,
      'Update .vscodeignore, or update allowedEntries / ceilings in scripts/check-vsix-contents.cjs deliberately.',
    );
  }

  console.log(
    `VS Code package contents check passed (${filePaths.length} files, ${totalSizeInBytes(filePaths)} bytes inspected).`,
  );
}

if (require.main === module) {
  main();
}
