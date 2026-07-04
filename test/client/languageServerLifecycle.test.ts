import {
  SHOW_LOGS_ACTION,
  RESTART_ACTION,
  startLanguageServer,
  restartLanguageServer,
} from '../../client/src/languageServerLifecycle';

describe('language server lifecycle', () => {
  it('starts the language server and runs the success callback', async () => {
    const client = createClient();
    const onStarted = jest.fn();
    const showErrorMessage = jest.fn();

    const started = await startLanguageServer(client, {
      onStarted,
      showErrorMessage,
    });

    expect(started).toBe(true);
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('logs startup failures and offers to show logs', async () => {
    const client = createClient({ startError: new Error('missing server bundle') });
    const showErrorMessage = jest.fn().mockResolvedValue(SHOW_LOGS_ACTION);

    const started = await startLanguageServer(client, {
      showErrorMessage,
    });

    expect(started).toBe(false);
    expect(client.outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('HAProxy language server failed to start.')
    );
    expect(client.outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('missing server bundle')
    );
    expect(showErrorMessage).toHaveBeenCalledWith(
      'HAProxy language server failed to start. See the HAProxy output channel for details.',
      SHOW_LOGS_ACTION,
      RESTART_ACTION
    );
    expect(client.outputChannel.show).toHaveBeenCalledWith(true);
  });

  it('retries through restart when the user selects restart', async () => {
    const client = createClient({ startErrorOnce: new Error('ipc failed') });
    const showErrorMessage = jest.fn().mockResolvedValue(RESTART_ACTION);
    const onStarted = jest.fn();

    const started = await startLanguageServer(client, {
      onStarted,
      showErrorMessage,
    });

    expect(started).toBe(false);
    expect(client.stop).toHaveBeenCalledTimes(1);
    expect(client.start).toHaveBeenCalledTimes(2);
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('restarts the language server and shows success only after start succeeds', async () => {
    const client = createClient();
    const onStarted = jest.fn();
    const showInformationMessage = jest.fn();
    const showErrorMessage = jest.fn();

    const restarted = await restartLanguageServer(client, {
      onStarted,
      showErrorMessage,
      showInformationMessage,
    });

    expect(restarted).toBe(true);
    expect(client.stop).toHaveBeenCalledTimes(1);
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(showInformationMessage).toHaveBeenCalledWith('HAProxy language server restarted.');
    expect(showErrorMessage).not.toHaveBeenCalled();
  });
});

function createClient(options: {
  startError?: Error;
  startErrorOnce?: Error;
} = {}) {
  let startCalls = 0;
  return {
    outputChannel: {
      appendLine: jest.fn(),
      show: jest.fn(),
    },
    start: jest.fn(() => {
      startCalls++;
      if (options.startError) throw options.startError;
      if (options.startErrorOnce && startCalls === 1) throw options.startErrorOnce;
      return Promise.resolve();
    }),
    stop: jest.fn(() => Promise.resolve()),
  };
}
