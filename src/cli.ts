#!/usr/bin/env node
import { CsvToMarkdown } from './csvToMarkdown.js';
import { MarkdownToCsv } from './markdownToCsv.js';

function usage(): never {
  process.stderr.write(
    'usage: mdtable <csv-to-md|md-to-csv> [--delimiter <char>] < input > output\n',
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

const direction = process.argv[2];
const delimiter = parseDelimiter(process.argv.slice(3));

if (direction === 'csv-to-md') {
  process.stdin.pipe(new CsvToMarkdown({ delimiter })).pipe(process.stdout);
} else if (direction === 'md-to-csv') {
  process.stdin.pipe(new MarkdownToCsv({ delimiter })).pipe(process.stdout);
} else {
  usage();
}
