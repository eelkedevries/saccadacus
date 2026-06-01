/**
 * Combined CSV writer and parser (PROPOSAL.md §14).
 *
 * Produces a single CSV containing time-series, event, and dot/task rows,
 * distinguished by `row_type`, sorted on the shared `performance.now()` time
 * axis so the streams stay aligned. Export is entirely local/browser-side; no
 * server storage, authentication, or upload (hard rule, §29).
 */
import { CSV_COLUMNS, CSV_HEADER, formatCell } from './schema';
import type { CombinedRow } from './schema';

/** Escape a CSV field, quoting when it contains a comma, quote, or newline. */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToLine(row: CombinedRow): string {
  return CSV_COLUMNS.map(([key]) => escapeField(formatCell(row[key]))).join(',');
}

/** Primary time-axis value for sorting, defaulting to 0 when absent. */
function rowTime(row: CombinedRow): number {
  return row.timestampPerformanceNow ?? row.eventOnset ?? row.dotTimestamp ?? 0;
}

/**
 * Build the combined CSV text from already-assembled rows. Rows are sorted by
 * their shared time axis; equal timestamps keep input order (stable sort).
 */
export function buildCombinedCsv(rows: CombinedRow[]): string {
  const sorted = [...rows].sort((a, b) => rowTime(a) - rowTime(b));
  const lines = sorted.map(rowToLine);
  return [CSV_HEADER, ...lines].join('\n');
}

export interface ParsedCsv {
  columns: string[];
  rows: Record<string, string>[];
}

/** Parse CSV text into header columns and per-row string maps (round-trip). */
export function parseCombinedCsv(csv: string): ParsedCsv {
  const lines = splitLines(csv);
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }
  const columns = parseLine(lines[0] as string);
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const record: Record<string, string> = {};
    columns.forEach((col, i) => {
      record[col] = cells[i] ?? '';
    });
    return record;
  });
  return { columns, rows };
}

function splitLines(csv: string): string[] {
  return csv.split(/\r?\n/).filter((line) => line.length > 0);
}

/** Parse a single CSV line honouring quoted fields and escaped quotes. */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
