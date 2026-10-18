import { HaproxyDocument } from './parser/ast';
import { OversizedDocumentTracker } from './documentSizePolicy';

/** Per-document server state: cached ASTs, pending validation timers and size tracking. */
export class DocumentState {
  readonly astCache = new Map<string, HaproxyDocument>();
  readonly oversizedDocuments = new OversizedDocumentTracker();
  private readonly validationTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Schedule a debounced validation, replacing any pending one for the same URI.
   *
   * @param uri Document URI.
   * @param delayMs Debounce delay in milliseconds.
   * @param validate Callback run once the delay elapses.
   * @returns Nothing.
   */
  scheduleValidation(uri: string, delayMs: number, validate: () => void): void {
    this.clearPendingValidation(uri);
    const timer = setTimeout(() => {
      this.validationTimers.delete(uri);
      validate();
    }, delayMs);
    this.validationTimers.set(uri, timer);
  }

  /**
   * Cancel the pending validation for a document, if any.
   *
   * @param uri Document URI.
   * @returns Nothing.
   */
  clearPendingValidation(uri: string): void {
    const timer = this.validationTimers.get(uri);
    if (timer) clearTimeout(timer);
    this.validationTimers.delete(uri);
  }

  /**
   * Drop all state held for a closed document.
   *
   * @param uri Document URI.
   * @returns Nothing.
   */
  release(uri: string): void {
    this.clearPendingValidation(uri);
    this.astCache.delete(uri);
    this.oversizedDocuments.delete(uri);
  }

  /**
   * Drop all state for every document, cancelling every pending validation.
   *
   * @returns Nothing.
   */
  releaseAll(): void {
    for (const timer of this.validationTimers.values()) clearTimeout(timer);
    this.validationTimers.clear();
    this.astCache.clear();
    this.oversizedDocuments.clear();
  }

  /**
   * Number of validations still waiting on their debounce timer.
   *
   * @returns Count of pending validation timers.
   */
  get pendingValidationCount(): number {
    return this.validationTimers.size;
  }
}
