#!/usr/bin/env node
import { Alignment, parseAlignmentList } from './alignment.js';
import { CsvToMarkdown } from './csvToMarkdown.js';
import { MarkdownToCsv } from './markdownToCsv.js';

function usage(): never {
  process.stderr.write(
    'usage: mdtable <csv-to-md|md-to-csv> [--delimiter <char>] [--align <list>] < input > output\n',
  );
  process.exit(1);
}

function parseDelimiter(args: string[]): string {
  const flagIndex = args.findIndex((arg) => arg === '--delimiter' || arg === '-d');
  if (flagIndex === -1) return ',';
  const value = args[flagIndex + 1];
  if (!value || value.length !== 1) {
    process.stderr.write('--delimiter requires a single character argument\n');
    process.exit(1);
  }
  return value;
}

function parseAlign(args: string[]): Alignment[] | undefined {
  const flagIndex = args.indexOf('--align');
  if (flagIndex === -1) return undefined;
  const value = args[flagIndex + 1];
  if (!value) {
    process.stderr.write('--align requires a list such as left,center,right\n');
    process.exit(1);
  }
  try {
    return parseAlignmentList(value);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }
}

const direction = process.argv[2];
const delimiter = parseDelimiter(process.argv.slice(3));
const alignments = parseAlign(process.argv.slice(3));

if (direction === 'csv-to-md') {
  process.stdin.pipe(new CsvToMarkdown({ delimiter, alignments })).pipe(process.stdout);
} else if (direction === 'md-to-csv') {
  process.stdin.pipe(new MarkdownToCsv({ delimiter })).pipe(process.stdout);
} else {
  usage();
}
