import { SectionType } from '../parser/ast';

/** Sections where a directive is valid. */
export type SectionMatrix = {
  readonly defaults: boolean;
  readonly frontend: boolean;
  readonly listen: boolean;
  readonly backend: boolean;
  /** Valid in global section */
  readonly global?: boolean;
};

/** A fully-typed directive definition. */
export interface DirectiveDef {
  readonly name: string;
  /** Human-readable signature showing parameter syntax. */
  readonly signature: string;
  /** One-line description. */
  readonly description: string;
  /** Sections where this directive is valid. */
  readonly sections: SectionMatrix;
  /** HAProxy version when this directive was introduced. */
  readonly since: string;
  /** HAProxy version when this directive was deprecated (still works). */
  readonly deprecated?: string;
  /** HAProxy version when this directive was removed (errors out). */
  readonly removed?: string;
  /** What to use instead, shown when the directive is deprecated or removed. */
  readonly migration?: string;
  /** Only valid when section mode is http. */
  readonly httpOnly?: true;
  /** Only valid when section mode is tcp. */
  readonly tcpOnly?: true;
  /** Can be prefixed with "no" to invert. */
  readonly invertible?: true;
  /** Link to official HAProxy documentation. */
  readonly docsUrl?: string;
  /** Category for grouping in completion UI. */
  readonly category?: DirectiveCategory;
  /**
   * Minimum number of arguments after the directive name (for a combined name
   * such as `stats uri`, after both words). Set only where the count is
   * unambiguous; leave undefined to skip arity validation entirely.
   */
  readonly minArgs?: number;
  /** Maximum number of arguments, only for genuinely fixed-arity directives. */
  readonly maxArgs?: number;
  /**
   * Human-readable names of the required arguments, in order, used in
   * diagnostics (e.g. `['a name', 'an address']`). Length must equal `minArgs`.
   */
  readonly requiredArgs?: readonly string[];
}

export type DirectiveCategory =
  | 'connection'
  | 'logging'
  | 'routing'
  | 'load-balancing'
  | 'health-check'
  | 'timeout'
  | 'option'
  | 'acl'
  | 'http'
  | 'tcp'
  | 'ssl'
  | 'server'
  | 'stats'
  | 'stick'
  | 'compression'
  | 'misc';

/** Helper: all proxy sections (D/F/L/B). */
export const ALL_PROXY: SectionMatrix = { defaults: true, frontend: true, listen: true, backend: true };
/** Helper: D/L/B but not F. */
export const DLB: SectionMatrix = { defaults: true, frontend: false, listen: true, backend: true };
/** Helper: D/F/L but not B. */
export const DFL: SectionMatrix = { defaults: true, frontend: true, listen: true, backend: false };
/** Helper: F/L only. */
export const FL: SectionMatrix = { defaults: false, frontend: true, listen: true, backend: false };
/** Helper: L/B only. */
export const LB: SectionMatrix = { defaults: false, frontend: false, listen: true, backend: true };
/** Helper: F/L/B. */
export const FLB: SectionMatrix = { defaults: false, frontend: true, listen: true, backend: true };
/** Helper: D/F/L/B — same as ALL_PROXY but explicit. */
export const DFLB = ALL_PROXY;

/** Convert SectionMatrix to array of SectionType strings for legacy compat. */
export function matrixToSections(m: SectionMatrix): SectionType[] {
  const out: SectionType[] = [];
  if (m.global) out.push('global');
  if (m.defaults) out.push('defaults');
  if (m.frontend) out.push('frontend');
  if (m.listen) out.push('listen');
  if (m.backend) out.push('backend');
  return out;
}
