#!/usr/bin/env node

const { execFileSync, execSync } = require('node:child_process');

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

function main() {
  const packageContents = listPackageContents();
  const filePaths = extractFilePaths(packageContents);
  const forbiddenFiles = findForbiddenFiles(filePaths);

  if (forbiddenFiles.length > 0) {
    console.error('Forbidden files were found in the VS Code extension package:');
    for (const filePath of forbiddenFiles) {
      console.error(`- ${filePath}`);
    }
    console.error('Update .vscodeignore before publishing.');
    process.exit(1);
  }

  console.log(`VS Code package contents check passed (${filePaths.length} files inspected).`);
}

if (require.main === module) {
  main();
}
