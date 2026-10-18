import { DocumentState } from '../../server/src/documentState';
import { HaproxyParser } from '../../server/src/parser/parser';

const DEBOUNCE_MS = 400;
const URI_A = 'test://a.cfg';
const URI_B = 'test://b.cfg';

function cacheAst(state: DocumentState, uri: string): void {
  state.astCache.set(uri, new HaproxyParser().parse('global\n    daemon\n', uri));
}

describe('DocumentState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces validation per document', () => {
    const state = new DocumentState();
    const validate = jest.fn();

    state.scheduleValidation(URI_A, DEBOUNCE_MS, validate);
    state.scheduleValidation(URI_A, DEBOUNCE_MS, validate);
    jest.advanceTimersByTime(DEBOUNCE_MS);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(state.pendingValidationCount).toBe(0);
  });

  it('cancels the pending validation and drops state when a document is released', () => {
    const state = new DocumentState();
    const validate = jest.fn();
    cacheAst(state, URI_A);
    state.oversizedDocuments.markSkipped(URI_A);
    state.scheduleValidation(URI_A, DEBOUNCE_MS, validate);

    state.release(URI_A);
    jest.runAllTimers();

    expect(validate).not.toHaveBeenCalled();
    expect(state.astCache.has(URI_A)).toBe(false);
    expect(state.oversizedDocuments.markSkipped(URI_A)).toBe(true);
  });

  it('leaves no pending timers or cached state after shutdown cleanup', () => {
    const state = new DocumentState();
    const validate = jest.fn();
    cacheAst(state, URI_A);
    cacheAst(state, URI_B);
    state.oversizedDocuments.markSkipped(URI_B);
    state.scheduleValidation(URI_A, DEBOUNCE_MS, validate);
    state.scheduleValidation(URI_B, DEBOUNCE_MS, validate);
    expect(jest.getTimerCount()).toBe(2);

    state.releaseAll();

    expect(jest.getTimerCount()).toBe(0);
    expect(state.pendingValidationCount).toBe(0);
    expect(state.astCache.size).toBe(0);
    expect(state.oversizedDocuments.markSkipped(URI_B)).toBe(true);
    jest.runAllTimers();
    expect(validate).not.toHaveBeenCalled();
  });
});
