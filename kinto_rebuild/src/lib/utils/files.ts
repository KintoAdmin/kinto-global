import * as fs from "node:fs";
import { join } from "node:path";

export function dataPath(...parts: string[]): string {
  const candidates = [
    join(process.cwd(), "data", ...parts),
    join(process.cwd(), ".next", "server", "data", ...parts),
    join(process.cwd(), "..", "data", ...parts),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}
