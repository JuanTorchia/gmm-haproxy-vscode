export const MAX_VALIDATION_LINE_COUNT = 10_000;

/**
 * Return true when live validation should be skipped for a document line count.
 *
 * @param lineCount Number of lines in the opened document.
 * @returns Whether diagnostics should be skipped for this document.
 */
export function shouldSkipValidationForLineCount(lineCount: number): boolean {
  return lineCount > MAX_VALIDATION_LINE_COUNT;
}

export class OversizedDocumentTracker {
  private readonly skippedUris = new Set<string>();

  /**
   * Mark a document as skipped and report whether this is the first skip signal.
   *
   * @param uri Document URI.
   * @returns True only the first time a URI is marked skipped.
   */
  markSkipped(uri: string): boolean {
    const wasAlreadySkipped = this.skippedUris.has(uri);
    this.skippedUris.add(uri);
    return !wasAlreadySkipped;
  }

  /**
   * Mark a document as no longer oversized.
   *
   * @param uri Document URI.
   * @returns Nothing.
   */
  markAllowed(uri: string): void {
    this.skippedUris.delete(uri);
  }

  /**
   * Remove tracking state for a closed document.
   *
   * @param uri Document URI.
   * @returns Nothing.
   */
  delete(uri: string): void {
    this.skippedUris.delete(uri);
  }
}
