#!/usr/bin/env node
import { CsvToMarkdown } from './csvToMarkdown.js';
import { MarkdownToCsv } from './markdownToCsv.js';

function usage(): never {
  process.stderr.write('usage: mdtable <csv-to-md|md-to-csv> < input > output\n');
  process.exit(1);
}

const direction = process.argv[2];

if (direction === 'csv-to-md') {
  process.stdin.pipe(new CsvToMarkdown()).pipe(process.stdout);
} else if (direction === 'md-to-csv') {
  process.stdin.pipe(new MarkdownToCsv()).pipe(process.stdout);
} else {
  usage();
}
