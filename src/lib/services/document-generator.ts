// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function artifactRoot() {
  return path.join(process.cwd(), "runtime_artifacts", "reports");
}

function safeName(value: string) {
  return String(value || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";
}

export async function generateDocumentArtifacts(input: {
  assessmentId: string;
  reportInstanceId: string;
  version: number;
  title: string;
  payload: unknown;
}) {
  const root = path.join(artifactRoot(), safeName(input.assessmentId), safeName(input.reportInstanceId), `v${input.version}`);
  await fs.mkdir(root, { recursive: true });

  const payloadPath = path.join(root, `${safeName(input.title)}.json`);
  const docxPath = path.join(root, `${safeName(input.title)}.docx`);
  const pptxPath = path.join(root, `${safeName(input.title)}.pptx`);

  await fs.writeFile(payloadPath, JSON.stringify(input.payload, null, 2), "utf8");

  const scriptPath = path.join(process.cwd(), "python_engine", "app", "generate_report_artifacts.py");
  const pythonBin = process.env.PYTHON_BIN || "python";

  await execFileAsync(pythonBin, [scriptPath, "--payload", payloadPath, "--docx", docxPath, "--pptx", pptxPath], {
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: "1" },
  });

  const [jsonStat, docxStat, pptxStat] = await Promise.all([fs.stat(payloadPath), fs.stat(docxPath), fs.stat(pptxPath)]);

  return {
    root,
    artifacts: [
      { fileType: "json", fileName: path.basename(payloadPath), storagePath: payloadPath, fileSize: jsonStat.size },
      { fileType: "docx", fileName: path.basename(docxPath), storagePath: docxPath, fileSize: docxStat.size },
      { fileType: "pptx", fileName: path.basename(pptxPath), storagePath: pptxPath, fileSize: pptxStat.size },
    ],
  };
}
