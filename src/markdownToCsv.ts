import { Transform, TransformCallback } from 'node:stream';
import { Alignment, alignmentFromSeparatorCell } from './alignment.js';

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

function csvEscape(field: string, delimiter: string): string {
  const needsQuoting =
    field.includes('"') || field.includes(delimiter) || field.includes('\n') || field.includes('\r');
  if (needsQuoting) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export interface MarkdownToCsvOptions {
  /** Field delimiter used for the output CSV. Defaults to ','. */
  delimiter?: string;
}

/**
 * Converts a Markdown table (GFM syntax) to CSV.
 *
 * Markdown table rows are always exactly one line each, so this only ever
 * needs to hold the current incomplete line in memory, not the whole input.
 */
export class MarkdownToCsv extends Transform {
  private buffered = '';
  private readonly delimiter: string;

  /**
   * Column alignments from the header separator row, once it has been read.
   * CSV has nowhere to store them, so they are also emitted as an
   * 'alignments' event for callers that want to feed them to CsvToMarkdown.
   */
  alignments: Alignment[] | undefined;

  constructor(options: MarkdownToCsvOptions = {}) {
    super();
    const delimiter = options.delimiter ?? ',';
    if (delimiter.length !== 1) {
      throw new Error(`delimiter must be a single character, got ${JSON.stringify(delimiter)}`);
    }
    this.delimiter = delimiter;
  }

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
    if (SEPARATOR_ROW.test(trimmed)) {
      // Only the first separator is the header's; a later one is just a
      // dropped row and must not overwrite the real alignments.
      if (this.alignments === undefined) {
        this.alignments = splitRow(line).map(alignmentFromSeparatorCell);
        this.emit('alignments', this.alignments);
      }
      return;
    }
    const cells = splitRow(line);
    this.push(cells.map((cell) => csvEscape(cell, this.delimiter)).join(this.delimiter) + '\n');
  }
}
