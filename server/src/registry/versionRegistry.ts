import { SectionType } from '../parser/ast';
import { DIRECTIVES } from '../data/directives';
import { GLOBAL_DIRECTIVES } from '../data/global';
import { SPECIAL_SECTION_DIRECTIVES } from '../data/special-sections';
import { matrixToSections } from '../data/types';

/** A directive definition as used by providers (completion, hover, validation). */
export interface DirectiveDefinition {
  readonly name: string;
  readonly sections: readonly SectionType[];
  readonly description: string;
  readonly signature: string;
  readonly sinceVersion: string;
  readonly deprecatedSinceVersion?: string;
  readonly removedInVersion?: string;
  readonly docsUrl?: string;
  readonly tcpOnly?: boolean;
  readonly httpOnly?: boolean;
  readonly invertible?: boolean;
  readonly category?: string;
}

/** Ordered list of known versions from oldest to newest. */
const KNOWN_VERSIONS = ['2.4', '2.6', '2.8', '3.0', '3.1'] as const;
export type KnownVersion = (typeof KNOWN_VERSIONS)[number];

/**
 * Registry that resolves directive definitions against a specific HAProxy version.
 * Uses the canonical DIRECTIVES list from server/src/data/directives.ts.
 */
export class VersionRegistry {
  private readonly cache = new Map<string, Map<string, DirectiveDefinition>>();

  /** Returns all directives valid for a given version as a name→definition map. */
  getDirectives(version: string): Map<string, DirectiveDefinition> {
    const resolved = this.resolveVersion(version);
    const cached = this.cache.get(resolved);
    if (cached) return cached;

    const map = new Map<string, DirectiveDefinition>();

    // Proxy and global directives
    const ALL_DIRECTIVES = [...DIRECTIVES, ...GLOBAL_DIRECTIVES];
    for (const d of ALL_DIRECTIVES) {
      if (this.compareVersions(resolved, d.since) < 0) continue;
      if (d.removed && this.compareVersions(resolved, d.removed) >= 0) continue;

      const def: DirectiveDefinition = {
        name: d.name,
        sections: matrixToSections(d.sections),
        description: d.description,
        signature: d.signature,
        sinceVersion: d.since,
        deprecatedSinceVersion: d.deprecated,
        removedInVersion: d.removed,
        docsUrl: d.docsUrl,
        httpOnly: d.httpOnly,
        tcpOnly: d.tcpOnly,
        invertible: d.invertible,
        category: d.category,
      };
      // Don't overwrite an existing entry — proxy definitions take precedence
      // (e.g. 'bind' or 'server' as proxy directives vs special-section variants)
      if (!map.has(d.name.toLowerCase())) {
        map.set(d.name.toLowerCase(), def);
      } else {
        // Merge sections: the same keyword may be valid in more sections
        const existing = map.get(d.name.toLowerCase())!;
        const merged: DirectiveDefinition = {
          ...existing,
          sections: Array.from(new Set([...existing.sections, ...matrixToSections(d.sections)])),
        };
        map.set(d.name.toLowerCase(), merged);
      }
    }

    // Special-section directives (peers, resolvers, userlist, mailers, etc.)
    for (const d of SPECIAL_SECTION_DIRECTIVES) {
      if (this.compareVersions(resolved, d.since) < 0) continue;
      if (d.removed && this.compareVersions(resolved, d.removed) >= 0) continue;

      const key = d.name.toLowerCase();
      if (map.has(key)) {
        // Directive already known (e.g. 'bind', 'server', 'timeout connect') —
        // extend its valid sections rather than overwriting.
        const existing = map.get(key)!;
        const merged: DirectiveDefinition = {
          ...existing,
          sections: Array.from(new Set([...existing.sections, ...d.sections])),
        };
        map.set(key, merged);
      } else {
        map.set(key, {
          name: d.name,
          sections: [...d.sections],
          description: d.description,
          signature: d.signature,
          sinceVersion: d.since,
          deprecatedSinceVersion: d.deprecated,
          removedInVersion: d.removed,
          docsUrl: d.docsUrl,
        });
      }
    }

    this.cache.set(resolved, map);
    return map;
  }

  /** Returns a single directive by name for a given version, or undefined. */
  getDirective(name: string, version: string): DirectiveDefinition | undefined {
    return this.getDirectives(version).get(name.toLowerCase());
  }

  /** True if the directive exists and is not removed in this version. */
  isAvailable(name: string, version: string): boolean {
    return this.getDirectives(version).has(name.toLowerCase());
  }

  /** True if the directive is deprecated (but not yet removed) in this version. */
  isDeprecated(name: string, version: string): boolean {
    const def = this.getDirective(name, version);
    if (!def?.deprecatedSinceVersion) return false;
    return this.compareVersions(version, def.deprecatedSinceVersion) >= 0;
  }

  getKnownVersions(): readonly string[] {
    return KNOWN_VERSIONS;
  }

  /** Find the nearest lower known version for an arbitrary version string. */
  resolveVersion(version: string): string {
    if ((KNOWN_VERSIONS as readonly string[]).includes(version)) return version;
    for (let i = KNOWN_VERSIONS.length - 1; i >= 0; i--) {
      const known = KNOWN_VERSIONS[i] as string;
      if (this.compareVersions(version, known) >= 0) return known;
    }
    return KNOWN_VERSIONS[0];
  }

  /**
   * Compare two version strings.
   * Returns negative if a < b, 0 if equal, positive if a > b.
   */
  compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
}
