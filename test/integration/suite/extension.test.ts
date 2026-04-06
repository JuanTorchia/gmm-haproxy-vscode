import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

const FIXTURE_PATH = path.resolve(__dirname, '../../../test/fixtures/basic.cfg');

suite('Extension activation', () => {
  test('extension is present', () => {
    const ext = vscode.extensions.getExtension('gmm.gmm-haproxy-vscode');
    assert.ok(ext, 'Extension gmm.gmm-haproxy-vscode not found');
  });

  test('extension activates on haproxy file', async () => {
    const ext = vscode.extensions.getExtension('gmm.gmm-haproxy-vscode');
    assert.ok(ext);
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true, 'Extension did not activate');
  });
});

suite('Language features on basic.cfg', () => {
  let doc: vscode.TextDocument;

  suiteSetup(async () => {
    const uri = vscode.Uri.file(FIXTURE_PATH);
    doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    // Wait for LSP to initialize and send diagnostics
    await new Promise((r) => setTimeout(r, 3000));
  });

  test('document language is haproxy', () => {
    assert.strictEqual(doc.languageId, 'haproxy');
  });

  test('no diagnostics on valid basic config', async () => {
    const diags = vscode.languages.getDiagnostics(doc.uri);
    const errors = diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
    assert.strictEqual(errors.length, 0, `Unexpected errors: ${errors.map((e) => e.message).join(', ')}`);
  });

  test('completion items available on backend line', async () => {
    // Position inside the backend web section (line 44, after 4 spaces)
    const pos = new vscode.Position(44, 5);
    const items = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      doc.uri,
      pos
    );
    assert.ok(items && items.items.length > 0, 'No completion items returned');
  });

  test('hover returns content on balance directive', async () => {
    // Find the line with 'balance roundrobin' in backend web-backend (around line 47)
    const text = doc.getText();
    const lines = text.split('\n');
    const balanceLine = lines.findIndex((l) => l.trim().startsWith('balance roundrobin'));
    assert.ok(balanceLine >= 0, 'balance directive not found in fixture');

    const pos = new vscode.Position(balanceLine, 6);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      doc.uri,
      pos
    );
    assert.ok(hovers && hovers.length > 0, 'No hover result');
    const content = hovers[0]!.contents
      .map((c) => (typeof c === 'string' ? c : 'value' in c ? c.value : ''))
      .join('');
    assert.ok(content.length > 0, 'Empty hover content');
  });
});
