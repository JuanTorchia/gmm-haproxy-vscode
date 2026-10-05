/** Lines inspected when deciding whether a generic .cfg/.conf file is HAProxy. */
export const DETECTION_LINE_LIMIT = 200;

const SECTION_HEADER =
  /^(global|defaults|frontend|backend|listen|userlist|peers|resolvers|mailers|ring|log-forward|program|http-errors|cache|acme)(\s|$)/;

const GENERIC_LANGUAGES = new Set(['plaintext', 'ini', 'properties']);
const CANDIDATE_EXTENSION = /\.(cfg|conf)$/i;

/**
 * Whether a document looks like an HAProxy configuration: HAProxy requires
 * section headers at column 0, which other .cfg/.conf formats do not use.
 * @param text Full document text.
 * @returns `true` when a section header appears within the first lines.
 */
export function looksLikeHaproxyConfig(text: string): boolean {
  const lines = text.split(/\r?\n/, DETECTION_LINE_LIMIT);
  return lines.some((line) => SECTION_HEADER.test(line));
}

/**
 * Whether a document may be switched to HAProxy by content detection.
 * Only generic languages are eligible, so another extension's choice is never overridden.
 * @param doc Language, file name and URI scheme of the document.
 * @returns `true` when detection should inspect the document.
 */
export function isDetectionCandidate(doc: {
  languageId: string;
  fileName: string;
  uriScheme: string;
}): boolean {
  return (
    doc.uriScheme === 'file' &&
    GENERIC_LANGUAGES.has(doc.languageId) &&
    CANDIDATE_EXTENSION.test(doc.fileName)
  );
}
