import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

jest.mock('vscode', () => ({}), { virtual: true });

const clientRequire = createRequire(resolve('client/package.json'));
const matcherPath = clientRequire.resolve('minimatch');
const { matchGlobPattern } = jest.requireActual(
  resolve('client/node_modules/vscode-languageclient/lib/common/utils/globPattern.js'),
);

describe('language-client minimatch compatibility and amplification limits', () => {
  it('preserves matching through the LSP glob utility', () => {
    const cases: Array<[string, string, boolean]> = [
    ['**/*.{cfg,conf}', '/etc/haproxy/haproxy.cfg', true],
    ['**/*.{cfg,conf}', '/etc/haproxy/backend.conf', true],
    ['**/*.{cfg,conf}', '/etc/haproxy/README.md', false],
    ['**/*.cfg', '/etc/haproxy/.private.cfg', false],
    ['**/haproxy/*.cfg', '/etc/nginx/default.cfg', false],
    ];
    for (const [pattern, fsPath, expected] of cases) {
    // Exercise the actual LSP call to makeRe(), not only the replacement library.
      expect(matchGlobPattern(pattern, { fsPath })).toBe(expected);
    }
  });

  it('preserves file-operation dot/ignoreCase matching and makeRe', () => {
    const { Minimatch } = clientRequire('minimatch');
    const matcher = new Minimatch('**/*.CFG', { dot: true, nocase: true });
    expect(matcher.makeRe()).toBeInstanceOf(RegExp);
    expect(matcher.match('/etc/.private.cfg')).toBe(true);
  });

  it('bounds preprocessing without hanging the test runner', () => {
    const child = spawnSync(process.execPath, ['--max-old-space-size=128', '-e', `
      const assert = require('node:assert/strict');
      const { Minimatch } = require(${JSON.stringify(matcherPath)});
      const pattern = Array(30).fill('**/../a/b').join('/');
      const bounded = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 });
      assert.equal(bounded.set.length, 64);
      const large = new Minimatch('{x,*}/{0..999}', { optimizationLevel: 2 });
      assert.equal(large.set.length, 2000);
      assert.equal(large.match('y/999'), true);
      assert.equal(large.match('.y/5'), false);
      const small = new Minimatch('**/../a/b/**/../c/d', { optimizationLevel: 2 });
      assert.equal(small.set.length, 4);
      assert.equal(small.match('../a/b/../c/d'), true);
      assert.equal(small.match('x/a/b/y/c/d'), true);
    `], { timeout: 5000, maxBuffer: 16 * 1024, encoding: 'utf8' });
    expect(child.error).toBeUndefined();
    expect(child.stderr).toBe('');
    expect(child.status).toBe(0);
  });
});
