import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { HaproxyDocument, HaproxySection } from '../parser/ast';

/**
 * Provides folding ranges — one per HAProxy section.
 * The fold spans from the section header to the line before the
 * next section (or to the last directive, for the final section).
 */
export class FoldingProvider {
  provideFoldingRanges(doc: HaproxyDocument): FoldingRange[] {
    const ranges: FoldingRange[] = [];

    for (let i = 0; i < doc.sections.length; i++) {
      const section = doc.sections[i];
      const nextSection = doc.sections[i + 1];

      const startLine = section.headerRange.startLine;
      const endLine = this.sectionEndLine(section, nextSection);

      // A fold needs at least 2 lines to be useful
      if (endLine <= startLine) continue;

      ranges.push({
        startLine,
        endLine,
        kind: FoldingRangeKind.Region,
      });
    }

    return ranges;
  }

  private sectionEndLine(
    section: HaproxySection,
    nextSection: HaproxySection | undefined
  ): number {
    if (nextSection) {
      // Fold ends on the line before the next section header,
      // skipping any blank lines between sections
      return Math.max(section.headerRange.startLine, nextSection.headerRange.startLine - 1);
    }

    // Last section: fold ends at last directive
    if (section.directives.length > 0) {
      return section.directives[section.directives.length - 1].range.endLine;
    }

    return section.headerRange.startLine;
  }
}
