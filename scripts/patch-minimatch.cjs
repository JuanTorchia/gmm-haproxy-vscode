// Backport isaacs/minimatch@77a0f5c without removing the LSP client's makeRe API.
// Fail closed on source drift; never silently skip an unrecognized dependency.
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');

const hashes = {
  commonjs: 'd224f71f20d7c206fcc5b7e9f747324c7698345a0b2c28d717dd9cf698306783',
  esm: '59821ec2ce0d3df968292036e5c831ad322b33e9c33a949ecbc9dfe125d165be',
};
const edits = [
  ['firstPhasePreProcess(globParts) {',
    'firstPhasePreProcess(globParts) {\n        const { braceExpandMax = 100_000 } = this.options;'],
  ["p2 === '..') {", "p2 === '..' || globParts.length >= braceExpandMax) {"],
  ['secondPhasePreProcess(globParts) {',
    'secondPhasePreProcess(globParts) {\n        if (globParts.length > 1000) return globParts;'],
];

/** Apply the upstream security fix to a verified source string. */
function patched(source) {
  for (const [before, after] of edits) {
    if (source.split(before).length !== 2) throw new Error(`Patch context changed: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}

const root = resolve(process.argv[2] || '.');
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
let count = 0;
for (const [location, pkg] of Object.entries(lock.packages)) {
  if (!location.endsWith('node_modules/minimatch')) continue;
  if (pkg.version === '11.0.4') continue; // Glob 14's patched matcher; no legacy API consumers.
  if (pkg.version !== '10.2.6') throw new Error(`Review minimatch ${pkg.version} before removing backport`);
  for (const [format, expected] of Object.entries(hashes)) {
    const file = resolve(root, location, 'dist', format, 'index.js');
    const source = readFileSync(file, 'utf8');
    const original = edits.reduce((value, [before, after]) => value.replace(after, before), source);
    const hash = createHash('sha256').update(original).digest('hex');
    if (hash !== expected) throw new Error(`Unrecognized minimatch source: ${file}`);
    const result = patched(original);
    if (source !== original && source !== result) throw new Error(`Partial backport: ${file}`);
    writeFileSync(file, result);
  }
  count++;
}
if (!count) throw new Error('No minimatch installation found');
console.log(`Verified minimatch amplification backport in ${count} installation(s)`);
