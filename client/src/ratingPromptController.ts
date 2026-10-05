import { env, ExtensionContext, TextEditor, Uri, window, workspace } from 'vscode';
import { LanguageClient, State } from 'vscode-languageclient/node';
import {
  applyAnswer,
  INITIAL_RATING_PROMPT_STATE,
  isMicrosoftVsCode,
  RatingPromptAnswer,
  RatingPromptState,
  recordUse,
  reviewUrl,
  shouldPrompt,
} from './ratingPrompt';

const STATE_KEY = 'haproxy.ratingPrompt';
const ENABLED_SETTING = 'ratingPrompt.enabled';
const HAPROXY_LANGUAGE_ID = 'haproxy';
const RATE_ACTION = 'Rate';
const LATER_ACTION = 'Later';
const NEVER_ACTION = "Don't ask again";

const ANSWERS: Readonly<Record<string, RatingPromptAnswer>> = {
  [RATE_ACTION]: 'rate',
  [LATER_ACTION]: 'later',
  [NEVER_ACTION]: 'never',
};

/**
 * Count days on which a HAProxy config is active while the language server runs,
 * and occasionally ask for a Marketplace rating. Only runs in Microsoft VS Code.
 * @param context Extension context providing global state and subscriptions.
 * @param client Language client whose running state gates what counts as a use.
 */
export function registerRatingPrompt(context: ExtensionContext, client: LanguageClient): void {
  if (!isMicrosoftVsCode(env.appName)) return;

  const isFirstSession = readState(context).firstUseAt === undefined;
  let promptedThisSession = false;

  const onEditor = async (editor: TextEditor | undefined): Promise<void> => {
    const document = editor?.document;
    if (document?.languageId !== HAPROXY_LANGUAGE_ID || document.uri.scheme !== 'file') return;
    if (!client.isRunning()) return;

    const now = new Date();
    const state = recordUse(readState(context), now);
    await context.globalState.update(STATE_KEY, state);

    if (!isEnabled() || !shouldPrompt(state, { isFirstSession, promptedThisSession }, now)) return;
    promptedThisSession = true;
    await showPrompt(context);
  };

  const handle = (editor: TextEditor | undefined): void => {
    onEditor(editor).catch(() => undefined);
  };

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(handle),
    client.onDidChangeState((event) => {
      if (event.newState === State.Running) handle(window.activeTextEditor);
    })
  );
}

async function showPrompt(context: ExtensionContext): Promise<void> {
  const selected = await window.showInformationMessage(
    'Is HAProxy Config useful to you? A Marketplace rating helps other operators find it.',
    RATE_ACTION,
    LATER_ACTION,
    NEVER_ACTION
  );
  const answer = selected === undefined ? undefined : ANSWERS[selected];
  await context.globalState.update(STATE_KEY, applyAnswer(readState(context), answer, new Date()));

  if (answer === 'rate') {
    const { publisher, name } = context.extension.packageJSON as { publisher: string; name: string };
    await env.openExternal(Uri.parse(reviewUrl(publisher, name)));
  }
}

function readState(context: ExtensionContext): RatingPromptState {
  return context.globalState.get<RatingPromptState>(STATE_KEY, INITIAL_RATING_PROMPT_STATE);
}

function isEnabled(): boolean {
  return workspace.getConfiguration('haproxy').get<boolean>(ENABLED_SETTING, true);
}
