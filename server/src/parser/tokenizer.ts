import { SourceRange, Token } from './ast';

/** Physical source segment that contributes tokens to one logical continued directive. */
export interface LogicalLineSegment {
  readonly text: string;
  readonly lineIndex: number;
  readonly startOffset: number;
  readonly rawLine: string;
}

/** One logical line: its physical segments and the index of the last physical line consumed. */
export interface LogicalLine {
  readonly segments: readonly LogicalLineSegment[];
  readonly endLineIndex: number;
}

/**
 * Read the logical line starting at `lineIndex`, joining trailing-backslash continuations.
 *
 * @param lines Physical source lines.
 * @param lineIndex Index of the first physical line to read.
 * @returns The logical line, or undefined when the line is blank or comment-only.
 */
export function readLogicalLine(lines: readonly string[], lineIndex: number): LogicalLine | undefined {
  const rawLine = lines[lineIndex] ?? '';
  const line = stripComment(rawLine);
  const trimmed = line.trim();
  if (trimmed === '') return undefined;

  const segments: LogicalLineSegment[] = [
    {
      text: trimContinuationMarker(trimmed),
      lineIndex,
      startOffset: line.length - line.trimStart().length,
      rawLine,
    },
  ];
  let endLineIndex = lineIndex;
  let continuedLine = trimmed;
  while (continuedLine.endsWith('\\') && endLineIndex + 1 < lines.length) {
    endLineIndex++;
    const nextRaw = lines[endLineIndex] ?? '';
    const nextLine = stripComment(nextRaw);
    const nextTrimmed = nextLine.trim();
    segments.push({
      text: trimContinuationMarker(nextTrimmed),
      lineIndex: endLineIndex,
      startOffset: nextLine.length - nextLine.trimStart().length,
      rawLine: nextRaw,
    });
    continuedLine = nextTrimmed;
  }

  return { segments, endLineIndex };
}

/**
 * Split logical line segments into whitespace-separated tokens, honouring quotes and escapes.
 *
 * @param segments Segments of one logical line.
 * @returns Tokens with their unquoted values and source ranges.
 */
export function tokenizeSegments(segments: readonly LogicalLineSegment[]): Token[] {
  const tokens: Token[] = [];

  for (const segment of segments) {
    const line = segment.text;
    let i = 0;

    while (i < line.length) {
      while (i < line.length && /\s/.test(line[i] ?? '')) i++;
      if (i >= line.length) break;

      const start = i + segment.startOffset;
      let value = '';

      if (line[i] === '"' || line[i] === "'") {
        const quoteChar = line[i];
        i++;
        while (i < line.length && line[i] !== quoteChar) {
          if (line[i] === '\\') i++;
          value += line[i] ?? '';
          i++;
        }
        i++; // closing quote
      } else {
        while (i < line.length && !/\s/.test(line[i] ?? '')) {
          value += line[i] ?? '';
          i++;
        }
      }

      if (value !== '') {
        tokens.push({
          value,
          range: makeRange(segment.lineIndex, start, segment.lineIndex, i + segment.startOffset),
        });
      }
    }
  }

  return tokens;
}

/**
 * Build a source range.
 *
 * @param startLine Zero-based start line.
 * @param startCharacter Zero-based start character.
 * @param endLine Zero-based end line.
 * @param endCharacter Zero-based end character (exclusive).
 * @returns The source range.
 */
export function makeRange(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): SourceRange {
  return { startLine, startCharacter, endLine, endCharacter };
}

function trimContinuationMarker(line: string): string {
  return line.endsWith('\\') ? line.slice(0, -1).trimEnd() : line;
}

function stripComment(line: string): string {
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (!ch) continue;
    if (inQuote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quoteChar) inQuote = false;
    } else {
      if (ch === '"' || ch === "'") { inQuote = true; quoteChar = ch; }
      else if (ch === '#') return line.slice(0, i);
    }
  }
  return line;
}
