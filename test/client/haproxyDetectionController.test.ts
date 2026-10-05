// Jest has no mock for the `vscode` module; the controller only needs it for its defaults.
jest.mock(
  'vscode',
  () => ({ workspace: {}, languages: {} }),
  { virtual: true }
);

import { registerHaproxyDetection } from '../../client/src/haproxyDetectionController';

type FakeDoc = {
  languageId: string;
  fileName: string;
  uri: { scheme: string };
  getText: () => string;
};

function doc(fileName: string, languageId: string, text: string): FakeDoc {
  return { languageId, fileName, uri: { scheme: 'file' }, getText: () => text };
}

function setup(openDocs: FakeDoc[]) {
  let onOpen: ((d: FakeDoc) => void) | undefined;
  const setLanguage = jest.fn().mockResolvedValue(undefined);
  const context = { subscriptions: [] as { dispose(): void }[] };
  registerHaproxyDetection(context as never, {
    textDocuments: () => openDocs as never,
    onDidOpenTextDocument: (listener) => {
      onOpen = listener as never;
      return { dispose: () => undefined };
    },
    setTextDocumentLanguage: setLanguage as never,
  });
  return { setLanguage, open: (d: FakeDoc) => onOpen?.(d), context };
}

describe('registerHaproxyDetection', () => {
  it('switches already-open HAProxy configs at registration', () => {
    const lb = doc('/etc/lb/lb.cfg', 'properties', 'frontend fe\n    bind :80\n');
    const { setLanguage } = setup([lb]);
    expect(setLanguage).toHaveBeenCalledWith(lb, 'haproxy');
  });

  it('switches HAProxy configs opened later', () => {
    const { setLanguage, open } = setup([]);
    const lb = doc('/srv/lb.conf', 'plaintext', 'global\n    maxconn 10\n');
    open(lb);
    expect(setLanguage).toHaveBeenCalledWith(lb, 'haproxy');
  });

  it('leaves nginx and setup.cfg files alone', () => {
    const { setLanguage, open } = setup([]);
    open(doc('/etc/nginx/site.conf', 'properties', 'server {\n    listen 80;\n}\n'));
    open(doc('/repo/setup.cfg', 'ini', '[metadata]\nname = x\n'));
    open(doc('/etc/nginx/nginx.conf', 'nginx', 'frontend looks-but-claimed\n'));
    expect(setLanguage).not.toHaveBeenCalled();
  });

  it('registers its listener for disposal', () => {
    const { context } = setup([]);
    expect(context.subscriptions).toHaveLength(1);
  });

  it('swallows setTextDocumentLanguage rejections', async () => {
    let onOpen: ((d: FakeDoc) => void) | undefined;
    const setLanguage = jest.fn().mockRejectedValue(new Error('closed'));
    registerHaproxyDetection({ subscriptions: [] } as never, {
      textDocuments: () => [] as never,
      onDidOpenTextDocument: (l) => { onOpen = l as never; return { dispose: () => undefined }; },
      setTextDocumentLanguage: setLanguage as never,
    });
    expect(() => onOpen?.(doc('/a/lb.cfg', 'properties', 'backend b\n'))).not.toThrow();
    await Promise.resolve();
  });
});
