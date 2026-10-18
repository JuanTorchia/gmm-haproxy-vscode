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
import { LogicalLineSegment, makeRange, readLogicalLine, tokenizeSegments } from './tokenizer';

const SECTION_KEYWORDS = new Set<string>([
  'global', 'defaults', 'frontend', 'backend', 'listen',
  'userlist', 'peers', 'resolvers', 'mailers', 'ring',
  'log-forward', 'program', 'http-errors', 'cache', 'acme',
]);

/**
 * Fault-tolerant HAProxy config parser.
 * Produces a typed AST even for partial or broken configs.
 */
export class HaproxyParser {
  parse(text: string, uri: string): HaproxyDocument {
    const lines = text.split(/\r?\n/);
    const sectionBuilders: SectionBuilder[] = [];
    const parseErrors: ParseError[] = [];

    let currentSection: SectionBuilder | null = null;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const logicalLine = readLogicalLine(lines, lineIndex);
      if (!logicalLine) continue;

      const startLineIndex = lineIndex;
      const { segments } = logicalLine;
      const rawLine = segments[0]?.rawLine ?? '';
      lineIndex = logicalLine.endLineIndex;

      const tokens = tokenizeSegments(segments);
      if (tokens.length === 0) continue;

      const firstToken = tokens[0];
      if (!firstToken) continue;
      const keyword = firstToken.value.toLowerCase();

      if (SECTION_KEYWORDS.has(keyword)) {
        if (currentSection) {
          sectionBuilders.push(currentSection);
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
      sectionBuilders.push(currentSection);
    }

    const sections = buildSections(sectionBuilders);
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

  get sectionType(): SectionType {
    return this.type;
  }

  get sectionName(): string {
    return this.name;
  }

  get inheritedFrom(): Token | undefined {
    return this.fromToken;
  }

  addDirective(directive: HaproxyDirective): void {
    this.directives.push(directive);
  }

  ownMode(): 'http' | 'tcp' | undefined {
    const modeDirective = this.directives.find((d) => d.keyword.value === 'mode');
    const modeValue = modeDirective?.args[0]?.value;
    return modeValue === 'http' || modeValue === 'tcp' ? modeValue : undefined;
  }

  build(mode = this.ownMode()): HaproxySection {
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

function buildSections(sectionBuilders: readonly SectionBuilder[]): HaproxySection[] {
  const defaultsModesByName = new Map<string, 'http' | 'tcp'>();
  for (const builder of sectionBuilders) {
    if (builder.sectionType === 'defaults') {
      const mode = builder.ownMode();
      if (mode) defaultsModesByName.set(builder.sectionName.toLowerCase(), mode);
    }
  }

  return sectionBuilders.map((builder) => builder.build(resolveMode(builder, defaultsModesByName)));
}

function resolveMode(
  section: SectionBuilder,
  defaultsModesByName: ReadonlyMap<string, 'http' | 'tcp'>
): 'http' | 'tcp' | undefined {
  const ownMode = section.ownMode();
  if (ownMode) return ownMode;

  if (
    section.sectionType !== 'frontend' &&
    section.sectionType !== 'backend' &&
    section.sectionType !== 'listen'
  ) return undefined;

  const key = section.inheritedFrom ? section.inheritedFrom.value.toLowerCase() : '';
  return defaultsModesByName.get(key);
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
