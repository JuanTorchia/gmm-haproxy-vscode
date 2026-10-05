// Jest has no mock for the `vscode` module; the helper only needs it for its defaults.
jest.mock('vscode', () => ({ workspace: {} }), { virtual: true });

import { createStartOnce, startWhenHaproxyAppears } from '../../client/src/lazyLanguageServer';

type FakeDoc = { languageId: string };

function setup(openDocs: FakeDoc[]) {
  let onOpen: ((d: FakeDoc) => void) | undefined;
  const dispose = jest.fn();
  const start = jest.fn();
  const context = { subscriptions: [] as { dispose(): void }[] };
  startWhenHaproxyAppears(context as never, start, {
    textDocuments: () => openDocs,
    onDidOpenTextDocument: (listener) => {
      onOpen = listener;
      return { dispose };
    },
  });
  return { start, dispose, context, open: (d: FakeDoc) => onOpen?.(d) };
}

describe('startWhenHaproxyAppears', () => {
  it('starts immediately when an HAProxy document is already open', () => {
    const { start, context } = setup([{ languageId: 'plaintext' }, { languageId: 'haproxy' }]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(context.subscriptions).toHaveLength(0);
  });

  it('waits while only other languages are open', () => {
    const { start, open } = setup([{ languageId: 'properties' }]);
    open({ languageId: 'ini' });
    expect(start).not.toHaveBeenCalled();
  });

  it('starts once when the first HAProxy document opens and stops listening', () => {
    const { start, dispose, open, context } = setup([]);
    expect(context.subscriptions).toHaveLength(1);
    open({ languageId: 'haproxy' });
    expect(start).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalled();
  });
});

describe('createStartOnce', () => {
  it('runs the start action once and shares its result', async () => {
    const start = jest.fn().mockResolvedValue(true);
    const server = createStartOnce(start);
    expect(server.hasStarted()).toBe(false);
    const [first, second] = await Promise.all([server.start(), server.start()]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(server.hasStarted()).toBe(true);
  });
});
