// @ts-nocheck
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

export function loadCsvRows(filePath: string, headerPrefixes?: string[]): Record<string, string>[] {
  const content = readFileSync(filePath, "utf8");
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);

  let startIndex = 0;
  if (headerPrefixes?.length) {
    const found = lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return headerPrefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
    });
    if (found >= 0) startIndex = found;
  }

  const trimmed = lines.slice(startIndex).join("\n").trim();
  if (!trimmed) return [];

  return parse(trimmed, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: false
  }) as Record<string, string>[];
}
