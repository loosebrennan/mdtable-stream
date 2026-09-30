import { Transform, TransformCallback } from 'node:stream';
import { Alignment, separatorCell } from './alignment.js';

function forMarkdownCell(field: string): string {
  // A table row is one line, so a literal newline in a CSV field has to
  // become something else or it would split the row in two.
  return field.replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>');
}

export interface CsvToMarkdownOptions {
  /** Field delimiter used by the input CSV. Defaults to ','. */
  delimiter?: string;
  /**
   * Alignment per column, in order. Columns past the end of the list, or
   * marked 'none', get a plain `---` separator.
   */
  alignments?: Alignment[];
}

/**
 * Converts CSV (RFC 4180 quoting) to a Markdown table.
 *
 * Unlike Markdown rows, a CSV record can legitimately contain a raw newline
 * inside a quoted field, so this can't just split on '\n'. Instead it scans
 * the buffered text for a newline that occurs outside of an open quote, and
 * only holds onto whatever hasn't reached one of those yet.
 */
export class CsvToMarkdown extends Transform {
  private buffered = '';
  private headerWritten = false;
  private columnCount = 0;
  private readonly delimiter: string;
  private readonly alignments: Alignment[];

  constructor(options: CsvToMarkdownOptions = {}) {
    super();
    const delimiter = options.delimiter ?? ',';
    if (delimiter.length !== 1) {
      throw new Error(`delimiter must be a single character, got ${JSON.stringify(delimiter)}`);
    }
    this.delimiter = delimiter;
    this.alignments = options.alignments ?? [];
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.buffered += chunk.toString('utf8');
    this.drainCompleteRecords();
    callback();
  }

  _flush(callback: TransformCallback): void {
    if (this.buffered.length > 0) {
      this.emitRecord(this.parseRecord(this.buffered));
    }
    callback();
  }

  private drainCompleteRecords(): void {
    let boundary = this.findRecordBoundary();
    while (boundary !== -1) {
      const record = this.buffered.slice(0, boundary);
      this.buffered = this.buffered.slice(boundary + 1);
      if (record.length > 0) {
        this.emitRecord(this.parseRecord(record));
      }
      boundary = this.findRecordBoundary();
    }
  }

  // Index of the first '\n' that lies outside a quoted field, or -1 if the
  // buffered text doesn't yet contain a full record.
  private findRecordBoundary(): number {
    let inQuotes = false;
    for (let i = 0; i < this.buffered.length; i++) {
      const ch = this.buffered[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === '\n' && !inQuotes) {
        return i;
      }
    }
    return -1;
  }

  private parseRecord(record: string): string[] {
    const line = record.replace(/\r$/, '');
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        if (ch === '"') {
          inQuotes = false;
          i += 1;
          continue;
        }
        current += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === this.delimiter) {
        fields.push(current);
        current = '';
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
    }
    fields.push(current);
    return fields;
  }

  private emitRecord(fields: string[]): void {
    const rendered = fields.map(forMarkdownCell);
    if (!this.headerWritten) {
      this.columnCount = rendered.length;
      this.headerWritten = true;
      this.push('| ' + rendered.join(' | ') + ' |\n');
      this.push('| ' + rendered.map((_, i) => separatorCell(this.alignments[i])).join(' | ') + ' |\n');
      return;
    }
    // A ragged CSV (fewer/more fields than the header) still has to produce
    // a valid table row, so pad or trim to the header's column count.
    const row = rendered.slice(0, this.columnCount);
    while (row.length < this.columnCount) row.push('');
    this.push('| ' + row.join(' | ') + ' |\n');
  }
}
