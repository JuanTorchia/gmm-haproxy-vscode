import {
  applyAnswer,
  INITIAL_RATING_PROMPT_STATE,
  isMicrosoftVsCode,
  MAX_PROMPTS,
  RatingPromptSession,
  RatingPromptState,
  recordUse,
  reviewUrl,
  shouldPrompt,
} from '../../client/src/ratingPrompt';

const START = new Date(2026, 0, 1, 10, 0, 0);
const LATER_SESSION: RatingPromptSession = { isFirstSession: false, promptedThisSession: false };

function daysAfter(days: number, hours = 0): Date {
  const date = new Date(START);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  return date;
}

function stateWithUseDays(days: readonly number[]): RatingPromptState {
  return days.reduce((state, day) => recordUse(state, daysAfter(day)), INITIAL_RATING_PROMPT_STATE);
}

const ELIGIBLE = stateWithUseDays([0, 1, 2, 3, 4]);

describe('recordUse', () => {
  it('records the first use time and counts the first day', () => {
    const state = recordUse(INITIAL_RATING_PROMPT_STATE, START);
    expect(state.firstUseAt).toBe(START.getTime());
    expect(state.useDays).toBe(1);
  });

  it('counts each calendar day once', () => {
    const sameDay = recordUse(recordUse(INITIAL_RATING_PROMPT_STATE, START), daysAfter(0, 5));
    expect(sameDay.useDays).toBe(1);
    expect(recordUse(sameDay, daysAfter(1)).useDays).toBe(2);
  });

  it('keeps the original first use time', () => {
    expect(stateWithUseDays([0, 3]).firstUseAt).toBe(START.getTime());
  });
});

describe('shouldPrompt', () => {
  it('prompts after 5 use days and 14 days since first use', () => {
    expect(shouldPrompt(ELIGIBLE, LATER_SESSION, daysAfter(14))).toBe(true);
  });

  it('waits for 14 days since first use', () => {
    expect(shouldPrompt(ELIGIBLE, LATER_SESSION, daysAfter(13))).toBe(false);
  });

  it('waits for 5 distinct use days', () => {
    expect(shouldPrompt(stateWithUseDays([0, 1, 2, 3]), LATER_SESSION, daysAfter(30))).toBe(false);
  });

  it('never prompts without any recorded use', () => {
    expect(shouldPrompt(INITIAL_RATING_PROMPT_STATE, LATER_SESSION, daysAfter(30))).toBe(false);
  });

  it('never prompts in the first session', () => {
    const session = { isFirstSession: true, promptedThisSession: false };
    expect(shouldPrompt(ELIGIBLE, session, daysAfter(14))).toBe(false);
  });

  it('prompts at most once per session', () => {
    const session = { isFirstSession: false, promptedThisSession: true };
    expect(shouldPrompt(ELIGIBLE, session, daysAfter(14))).toBe(false);
  });

  it('postpones for 30 days after "Later"', () => {
    const snoozed = applyAnswer(ELIGIBLE, 'later', daysAfter(14));
    expect(shouldPrompt(snoozed, LATER_SESSION, daysAfter(43))).toBe(false);
    expect(shouldPrompt(snoozed, LATER_SESSION, daysAfter(44))).toBe(true);
  });

  it('treats a dismissed notification like "Later"', () => {
    const dismissed = applyAnswer(ELIGIBLE, undefined, daysAfter(14));
    expect(shouldPrompt(dismissed, LATER_SESSION, daysAfter(20))).toBe(false);
    expect(shouldPrompt(dismissed, LATER_SESSION, daysAfter(44))).toBe(true);
  });

  for (const answer of ['rate', 'never'] as const) {
    it(`stops permanently after "${answer}"`, () => {
      const answered = applyAnswer(ELIGIBLE, answer, daysAfter(14));
      expect(shouldPrompt(answered, LATER_SESSION, daysAfter(400))).toBe(false);
    });
  }

  it(`shows the prompt at most ${MAX_PROMPTS} times`, () => {
    const once = applyAnswer(ELIGIBLE, 'later', daysAfter(14));
    const twice = applyAnswer(once, 'later', daysAfter(44));
    expect(twice.promptCount).toBe(2);
    expect(shouldPrompt(twice, LATER_SESSION, daysAfter(400))).toBe(false);
  });
});

describe('reviewUrl', () => {
  it('links to the Marketplace review section', () => {
    expect(reviewUrl('gmm', 'gmm-haproxy-vscode')).toBe(
      'https://marketplace.visualstudio.com/items?itemName=gmm.gmm-haproxy-vscode&ssr=false#review-details'
    );
  });
});

describe('isMicrosoftVsCode', () => {
  it('accepts Microsoft VS Code builds', () => {
    expect(isMicrosoftVsCode('Visual Studio Code')).toBe(true);
    expect(isMicrosoftVsCode('Visual Studio Code - Insiders')).toBe(true);
  });

  it('rejects other VS Code-based editors', () => {
    for (const appName of ['Cursor', 'VSCodium', 'Windsurf']) {
      expect(isMicrosoftVsCode(appName)).toBe(false);
    }
  });
});
