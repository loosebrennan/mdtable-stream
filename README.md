# mdtable-stream

Converts between Markdown tables (GitHub Flavored Markdown syntax) and CSV.

Markdown tables are the easy way to show tabular data in docs, READMEs, and
issues, but they're awkward to edit as data — nobody wants to hand-align
pipes for a 500-row table. CSV is easy to edit in a spreadsheet but doesn't
render anywhere. This converts between the two.

The one thing most quick scripts for this get wrong is memory: they read the
whole file into a string, split it, and process it in one go. That's fine
for a table with ten rows, but it falls over on a large generated export
(say, a table dumped straight from a database query). This is built as a
pair of Node `Transform` streams, so conversion runs in constant memory no
matter how large the input is — at most the current line (or, for CSV, the
current unfinished quoted record) is held in memory at once.

## Usage

Build once:

```
npm run build
```

As a CLI, reading from stdin and writing to stdout:

```
cat data.csv | node dist/cli.js csv-to-md > table.md
cat table.md | node dist/cli.js md-to-csv > data.csv
```

The CSV side defaults to a comma. Pass `--delimiter` (or `-d`) with a single
character to use something else, e.g. a semicolon-delimited export:

```
cat data.csv | node dist/cli.js csv-to-md --delimiter ';' > table.md
```

As a library, piped straight from one file stream to another:

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { CsvToMarkdown } from './src/csvToMarkdown.js';

createReadStream('data.csv')
  .pipe(new CsvToMarkdown({ delimiter: ';' }))
  .pipe(createWriteStream('table.md'));
```

Example, CSV in:

```
name,role,notes
Ada,engineer,"worked nights, mostly"
Grace,"engineer
(compilers)",
```

Markdown out:

```
| name | role | notes |
| --- | --- | --- |
| Ada | engineer | worked nights, mostly |
| Grace | engineer<br>(compilers) |  |
```

## Format notes

- **CSV to Markdown**: parses RFC 4180 quoting, including quoted fields that
  contain commas or literal newlines. Pipe characters become `\|`; newlines
  inside a field become `<br>`, since a Markdown table row has to be one
  line. The first record becomes the header, with a `---` separator row
  generated under it.
- **Markdown to CSV**: the header separator row is detected and dropped.
  `\|` inside a cell round-trips back to a literal `|` in the CSV.
- **Alignment**: `MarkdownToCsv` reads the alignment markers (`:---`,
  `:---:`, `---:`) from the separator row into its `alignments` property and
  emits an `'alignments'` event. `CsvToMarkdown` takes an `alignments` option
  (`'left' | 'center' | 'right' | 'none'` per column) and writes matching
  markers. On the command line, use a comma-separated list:

  ```
  cat data.csv | node dist/cli.js csv-to-md --align left,center,right > table.md
  ```

  In a pipeline, wait for the event before building the second stream:

  ```ts
  const toCsv = new MarkdownToCsv();
  toCsv.once('alignments', (alignments) => {
    // use as CsvToMarkdown({ alignments }) later
  });
  ```

## Known limitations

This is an early skeleton, not a finished tool:

- CSV has no place to store column alignment, so it can't survive a file
  round trip on its own. The CLI takes `--align` for CSV → Markdown, and the
  library exposes the alignments read by `MarkdownToCsv` (see above).
- A ragged CSV (a row with a different field count than the header) is
  padded or truncated rather than flagged.
- No dedicated TSV mode yet (`--delimiter $'\t'` gets you tab-separated
  fields, but the CLI doesn't special-case tab escaping or file extensions).
- No CLI flag for reading/writing files directly (stdin/stdout only).

## License

MIT, see [LICENSE](./LICENSE).
