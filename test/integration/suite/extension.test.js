'use strict';
const assert = require('assert');
const vscode = require('vscode');
const path = require('path');

const FIXTURE_PATH = path.resolve(__dirname, '../../../test/fixtures/basic.cfg');

suite('Extension activation', () => {
  test('extension is present', () => {
    const ext = vscode.extensions.getExtension('gmm.gmm-haproxy-vscode');
    assert.ok(ext, 'Extension gmm.gmm-haproxy-vscode not found');
  });

  test('extension activates on haproxy file', async () => {
    const ext = vscode.extensions.getExtension('gmm.gmm-haproxy-vscode');
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true, 'Extension did not activate');
  });
});

suite('Language features on basic.cfg', () => {
  /** @type {vscode.TextDocument} */
  let doc;

  suiteSetup(async () => {
    const uri = vscode.Uri.file(FIXTURE_PATH);
    doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    // Allow LSP to initialize and publish diagnostics
    await new Promise((r) => setTimeout(r, 3000));
  });

  test('document language is haproxy', () => {
    assert.strictEqual(doc.languageId, 'haproxy');
  });

  test('no errors on valid basic config', async () => {
    const diags = vscode.languages.getDiagnostics(doc.uri);
    const errors = diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
    assert.strictEqual(
      errors.length,
      0,
      `Unexpected errors:\n${errors.map((e) => `  ${e.message}`).join('\n')}`
    );
  });

  test('completion items available in backend section', async () => {
    // Find a line inside the backend web-backend section
    const lines = doc.getText().split('\n');
    const backendLine = lines.findIndex((l) => l.trim().startsWith('balance roundrobin'));
    assert.ok(backendLine >= 0, 'balance roundrobin line not found in fixture');

    const pos = new vscode.Position(backendLine, 6);
    const list = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      doc.uri,
      pos
    );
    assert.ok(list && list.items.length > 0, 'No completion items returned');
  });

  test('hover returns content for balance directive', async () => {
    const lines = doc.getText().split('\n');
    const balanceLine = lines.findIndex((l) => l.trim().startsWith('balance roundrobin'));
    assert.ok(balanceLine >= 0);

    const pos = new vscode.Position(balanceLine, 6);
    const hovers = await vscode.commands.executeCommand(
      'vscode.executeHoverProvider',
      doc.uri,
      pos
    );
    assert.ok(hovers && hovers.length > 0, 'No hover result returned');
  });
});
