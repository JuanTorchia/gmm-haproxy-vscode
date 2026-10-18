// Fails when any manifest declares @types/vscode other than the engines.vscode
// floor. Newer types let tsc accept APIs that do not exist in the oldest
// VS Code we claim to support, which only surfaces as a runtime TypeError.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readManifest = (dir) => JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));

const floor = readManifest('.').engines.vscode.replace(/^\^/, '');
const failures = [];

for (const dir of ['.', 'client', 'server']) {
  const manifest = readManifest(dir);
  const declared = { ...manifest.dependencies, ...manifest.devDependencies }['@types/vscode'];
  if (declared !== undefined && declared !== floor) {
    failures.push(`${dir}/package.json declares @types/vscode "${declared}", expected "${floor}" (engines.vscode)`);
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(`@types/vscode matches engines.vscode floor ${floor} in every manifest.`);
