import {
  MAX_VALIDATION_LINE_COUNT,
  OversizedDocumentTracker,
  shouldSkipValidationForLineCount,
} from '../../server/src/documentSizePolicy';

describe('document size policy', () => {
  it('allows documents at the validation line limit', () => {
    expect(shouldSkipValidationForLineCount(MAX_VALIDATION_LINE_COUNT)).toBe(false);
  });

  it('skips diagnostics for documents over the validation line limit', () => {
    expect(shouldSkipValidationForLineCount(MAX_VALIDATION_LINE_COUNT + 1)).toBe(true);
  });

  it('reports an oversized document only once until it returns under the limit', () => {
    const tracker = new OversizedDocumentTracker();
    const uri = 'test://large.cfg';

    expect(tracker.markSkipped(uri)).toBe(true);
    expect(tracker.markSkipped(uri)).toBe(false);

    tracker.markAllowed(uri);

    expect(tracker.markSkipped(uri)).toBe(true);
  });
});
