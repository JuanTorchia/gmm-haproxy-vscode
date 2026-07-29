/** Source range within a document. All values are 0-based. */
export interface SourceRange {
  readonly startLine: number;
  readonly startCharacter: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

/** A single token extracted by the lexer. */
export interface Token {
  readonly value: string;
  readonly range: SourceRange;
}

/** A parsed argument to a directive (keyword or quoted string). */
export interface DirectiveArg {
  readonly value: string;
  readonly range: SourceRange;
}

/** A single directive line inside a section, e.g. `option httplog` or `server web1 10.0.0.1:80`. */
export interface HaproxyDirective {
  readonly keyword: Token;
  readonly args: readonly DirectiveArg[];
  readonly range: SourceRange;
  /** Raw text of the line (for formatting). */
  readonly raw: string;
}

/** Known HAProxy top-level section types. */
export type SectionType =
  | 'global'
  | 'defaults'
  | 'frontend'
  | 'backend'
  | 'listen'
  | 'userlist'
  | 'peers'
  | 'resolvers'
  | 'mailers'
  | 'ring'
  | 'log-forward'
  | 'program'
  | 'http-errors'
  | 'cache'
  | 'acme'
  | 'unknown';

/** A section block, e.g. `frontend http-in` with all its directives. */
export interface HaproxySection {
  readonly type: SectionType;
  /** The name after the section keyword, e.g. `http-in` in `frontend http-in`. May be empty. */
  readonly name: string;
  /** Token for the section name, carrying its source range. Absent for unnamed sections (global, anonymous defaults). */
  readonly nameToken?: Token;
  /** Token for the named defaults section inherited via `from <name>` in the section header. Absent if not specified. */
  readonly from?: Token;
  readonly headerRange: SourceRange;
  readonly directives: readonly HaproxyDirective[];
  /**
   * Inherited mode from `mode` directive in this section (or 'defaults' section).
   * Undefined if not yet resolved.
   */
  readonly mode: 'http' | 'tcp' | undefined;
}

/** Top-level parse result for a single HAProxy config document. */
export interface HaproxyDocument {
  readonly uri: string;
  readonly sections: readonly HaproxySection[];
  /** Parse errors encountered during fault-tolerant parsing. */
  readonly parseErrors: readonly ParseError[];
}

/** A non-fatal parse error. The parser continues despite these. */
export interface ParseError {
  readonly message: string;
  readonly range: SourceRange;
}
