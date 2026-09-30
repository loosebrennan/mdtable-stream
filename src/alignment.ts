export type Alignment = 'left' | 'center' | 'right' | 'none';

const ALIGNMENTS: readonly Alignment[] = ['left', 'center', 'right', 'none'];

/** Reads the alignment out of one separator cell such as `:---:` or `---:`. */
export function alignmentFromSeparatorCell(cell: string): Alignment {
  const starts = cell.startsWith(':');
  const ends = cell.endsWith(':');
  if (starts && ends) return 'center';
  if (starts) return 'left';
  if (ends) return 'right';
  return 'none';
}

/** Renders one separator cell for the given alignment. */
export function separatorCell(alignment: Alignment | undefined): string {
  switch (alignment) {
    case 'left':
      return ':---';
    case 'center':
      return ':---:';
    case 'right':
      return '---:';
    default:
      return '---';
  }
}

/**
 * Parses a comma-separated list like `left,center,right,none` (as given to
 * the CLI). Throws on an unknown name so a typo doesn't silently turn into
 * an unaligned column.
 */
export function parseAlignmentList(list: string): Alignment[] {
  return list.split(',').map((raw) => {
    const name = raw.trim().toLowerCase();
    const match = ALIGNMENTS.find((a) => a === name);
    if (!match) {
      throw new Error(`unknown alignment ${JSON.stringify(raw)}, expected one of ${ALIGNMENTS.join(', ')}`);
    }
    return match;
  });
}
