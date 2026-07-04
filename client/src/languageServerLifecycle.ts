/** Notification action that reveals the HAProxy output channel. */
export const SHOW_LOGS_ACTION = 'Show Logs';

/** Notification action that retries language server startup. */
export const RESTART_ACTION = 'Restart';

type FailureAction = typeof SHOW_LOGS_ACTION | typeof RESTART_ACTION;

interface OutputChannelLike {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
}

export interface LanguageServerClientLike {
  readonly outputChannel: OutputChannelLike;
  /** Start the language server. */
  start(): PromiseLike<void>;
  /** Stop the language server. */
  stop(): PromiseLike<void>;
}

/** Callbacks used to report language server lifecycle status to VS Code. */
export interface LanguageServerLifecycleOptions {
  readonly onStarted?: () => void;
  readonly showErrorMessage: (
    message: string,
    ...items: FailureAction[]
  ) => PromiseLike<FailureAction | undefined>;
  readonly showInformationMessage?: (message: string) => PromiseLike<unknown>;
}

/** Start the HAProxy language server and surface startup failures to the user. */
export async function startLanguageServer(
  client: LanguageServerClientLike,
  options: LanguageServerLifecycleOptions
): Promise<boolean> {
  try {
    await client.start();
    options.onStarted?.();
    return true;
  } catch (error) {
    await handleStartupFailure(client, options, error, true);
    return false;
  }
}

/** Restart the HAProxy language server and surface restart failures to the user. */
export async function restartLanguageServer(
  client: LanguageServerClientLike,
  options: LanguageServerLifecycleOptions
): Promise<boolean> {
  try {
    await client.stop();
    await client.start();
    options.onStarted?.();
    await options.showInformationMessage?.('HAProxy language server restarted.');
    return true;
  } catch (error) {
    await handleStartupFailure(client, options, error, false);
    return false;
  }
}

async function handleStartupFailure(
  client: LanguageServerClientLike,
  options: LanguageServerLifecycleOptions,
  error: unknown,
  allowRestart: boolean
): Promise<void> {
  const message = 'HAProxy language server failed to start.';
  client.outputChannel.appendLine(`[Error - ${new Date().toLocaleTimeString()}] ${message}`);
  client.outputChannel.appendLine(errorToString(error));

  const actions: FailureAction[] = allowRestart
    ? [SHOW_LOGS_ACTION, RESTART_ACTION]
    : [SHOW_LOGS_ACTION];
  const selected = await options.showErrorMessage(
    `${message} See the HAProxy output channel for details.`,
    ...actions
  );

  if (selected === SHOW_LOGS_ACTION) {
    client.outputChannel.show(true);
  }

  if (selected === RESTART_ACTION) {
    await restartLanguageServer(client, options);
  }
}

function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}
