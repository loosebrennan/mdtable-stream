import { Transform, TransformCallback } from 'node:stream';

// A separator row looks like `| --- | :---: | ---: |`, with each cell being
// dashes optionally flanked by colons for alignment. It carries no data.
const SEPARATOR_ROW = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

/**
 * Splits one Markdown table row line into its cell strings.
 * `\|` inside a cell is an escaped pipe, not a column boundary.
 */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const inner =
    withoutLeadingPipe.endsWith('|') && !withoutLeadingPipe.endsWith('\\|')
      ? withoutLeadingPipe.slice(0, -1)
      : withoutLeadingPipe;

  const cells: string[] = [];
  let current = '';
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      current += '|';
      i += 2;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  cells.push(current.trim());
  return cells;
}

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Converts a Markdown table (GFM syntax) to CSV.
 *
 * Markdown table rows are always exactly one line each, so this only ever
 * needs to hold the current incomplete line in memory, not the whole input.
 */
export class MarkdownToCsv extends Transform {
  private buffered = '';

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.buffered += chunk.toString('utf8');
    const lines = this.buffered.split('\n');
    this.buffered = lines.pop() ?? '';
    for (const line of lines) {
      this.emitLine(line);
    }
    callback();
  }

  _flush(callback: TransformCallback): void {
    if (this.buffered.length > 0) {
      this.emitLine(this.buffered);
    }
    callback();
  }

  private emitLine(rawLine: string): void {
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();
    if (trimmed.length === 0 || !trimmed.includes('|')) return;
    if (SEPARATOR_ROW.test(trimmed)) return;
    const cells = splitRow(line);
    this.push(cells.map(csvEscape).join(',') + '\n');
  }
}
