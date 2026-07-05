import {
  HaproxyDocument,
  HaproxySection,
  HaproxyDirective,
  SectionType,
  SourceRange,
  Token,
  DirectiveArg,
  ParseError,
} from './ast';

const SECTION_KEYWORDS = new Set<string>([
  'global', 'defaults', 'frontend', 'backend', 'listen',
  'userlist', 'peers', 'resolvers', 'mailers', 'ring',
  'log-forward', 'program', 'http-errors', 'cache',
]);

/** Physical source segment that contributes tokens to one logical continued directive. */
interface LogicalLineSegment {
  readonly text: string;
  readonly lineIndex: number;
  readonly startOffset: number;
  readonly rawLine: string;
}

/**
 * Fault-tolerant HAProxy config parser.
 * Produces a typed AST even for partial or broken configs.
 */
export class HaproxyParser {
  parse(text: string, uri: string): HaproxyDocument {
    const lines = text.split(/\r?\n/);
    const sections: HaproxySection[] = [];
    const parseErrors: ParseError[] = [];

    let currentSection: SectionBuilder | null = null;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex] ?? '';
      const line = stripComment(rawLine);
      const trimmed = line.trim();
      const indentLength = line.length - line.trimStart().length;

      if (trimmed === '') continue;

      // Handle line continuation (backslash at end)
      const startLineIndex = lineIndex;
      const segments: LogicalLineSegment[] = [
        {
          text: trimContinuationMarker(trimmed),
          lineIndex,
          startOffset: indentLength,
          rawLine,
        },
      ];
      let continuedLine = trimmed;
      while (continuedLine.endsWith('\\') && lineIndex + 1 < lines.length) {
        lineIndex++;
        const nextRaw = lines[lineIndex] ?? '';
        const nextLine = stripComment(nextRaw);
        const nextTrimmed = nextLine.trim();
        segments.push({
          text: trimContinuationMarker(nextTrimmed),
          lineIndex,
          startOffset: nextLine.length - nextLine.trimStart().length,
          rawLine: nextRaw,
        });
        continuedLine = nextTrimmed;
      }

      const tokens = tokenizeSegments(segments);
      if (tokens.length === 0) continue;

      const firstToken = tokens[0];
      if (!firstToken) continue;
      const keyword = firstToken.value.toLowerCase();

      if (SECTION_KEYWORDS.has(keyword)) {
        if (currentSection) {
          sections.push(currentSection.build());
        }

        // Detect optional `from <defaults-name>` clause in the section header
        const fromIdx = tokens.findIndex((t, i) => i > 0 && t.value.toLowerCase() === 'from');
        const fromToken = fromIdx !== -1 ? tokens[fromIdx + 1] : undefined;

        // tokens[1] is the section name unless it is the `from` keyword itself
        const rawNameToken = tokens[1];
        const nameToken = rawNameToken?.value.toLowerCase() !== 'from' ? rawNameToken : undefined;
        const name = nameToken?.value ?? '';

        currentSection = new SectionBuilder(
          keyword as SectionType,
          name,
          nameToken,
          fromToken,
          makeRange(startLineIndex, 0, startLineIndex, rawLine.length)
        );
      } else if (currentSection) {
        const directive = buildDirective(tokens, segments);
        currentSection.addDirective(directive);
      } else {
        parseErrors.push({
          message: `Directive '${firstToken.value}' appears outside of any section.`,
          range: makeRange(startLineIndex, 0, startLineIndex, rawLine.length),
        });
      }
    }

    if (currentSection) {
      sections.push(currentSection.build());
    }

    // Resolve mode inheritance from defaults
    resolveMode(sections);

    return { uri, sections, parseErrors };
  }
}

class SectionBuilder {
  private readonly directives: HaproxyDirective[] = [];

  constructor(
    private readonly type: SectionType,
    private readonly name: string,
    private readonly sectionNameToken: Token | undefined,
    private readonly fromToken: Token | undefined,
    private readonly headerRange: SourceRange
  ) {}

  addDirective(directive: HaproxyDirective): void {
    this.directives.push(directive);
  }

  build(): HaproxySection {
    const modeDirective = this.directives.find((d) => d.keyword.value === 'mode');
    const modeValue = modeDirective?.args[0]?.value;
    const mode: 'http' | 'tcp' | undefined =
      modeValue === 'http' || modeValue === 'tcp' ? modeValue : undefined;

    return {
      type: this.type,
      name: this.name,
      nameToken: this.sectionNameToken,
      from: this.fromToken,
      headerRange: this.headerRange,
      directives: this.directives,
      mode,
    };
  }
}

function resolveMode(sections: HaproxySection[]): void {
  // Index all defaults sections by name (empty string = the unnamed/global defaults)
  const defaultsByName = new Map<string, HaproxySection>();
  for (const s of sections) {
    if (s.type === 'defaults') {
      defaultsByName.set(s.name.toLowerCase(), s);
    }
  }

  for (const section of sections) {
    if (section.type !== 'frontend' && section.type !== 'backend' && section.type !== 'listen') {
      continue;
    }
    if (section.mode) continue;

    // Use the named defaults referenced by `from`, falling back to the unnamed defaults.
    const key = section.from ? section.from.value.toLowerCase() : '';
    const defaultMode = defaultsByName.get(key)?.mode;
    if (defaultMode) {
      // Cast required because mode is readonly — we mutate during build resolution only
      (section as { mode?: 'http' | 'tcp' }).mode = defaultMode;
    }
  }
}

function buildDirective(
  tokens: Token[],
  segments: readonly LogicalLineSegment[]
): HaproxyDirective {
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const startLine = firstSegment?.lineIndex ?? 0;
  const endLine = lastSegment?.lineIndex ?? startLine;
  const endChar = lastSegment?.rawLine.trimEnd().length ?? 0;
  const [keywordToken, ...argTokens] = tokens;
  const keyword = keywordToken ?? { value: '', range: makeRange(startLine, 0, startLine, 0) };

  const args: DirectiveArg[] = argTokens.map((t) => ({
    value: t.value,
    range: t.range,
  }));

  return {
    keyword,
    args,
    range: makeRange(startLine, 0, endLine, endChar),
    raw: firstSegment?.rawLine ?? '',
  };
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

function tokenizeSegments(segments: readonly LogicalLineSegment[]): Token[] {
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
          range: makeRange(
            segment.lineIndex,
            start,
            segment.lineIndex,
            i + segment.startOffset
          ),
        });
      }
    }
  }

  return tokens;
}

function makeRange(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): SourceRange {
  return { startLine, startCharacter, endLine, endCharacter };
}
