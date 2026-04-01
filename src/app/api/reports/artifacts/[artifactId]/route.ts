// @ts-nocheck
import { readFile } from "fs/promises";
import * as path from "path";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/http";
import { getArtifact } from "@/lib/repositories/report-delivery";

function contentType(fileType: string) {
  if (fileType === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (fileType === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/json; charset=utf-8";
}

export async function GET(_: Request, context: { params: Promise<{ artifactId: string }> }) {
  try {
    const { artifactId } = await context.params;
    const artifact = await getArtifact(artifactId);
    if (!artifact?.storage_path) {
      return NextResponse.json({ ok: false, error: "Artifact not found." }, { status: 404 });
    }
    const absolutePath = path.resolve(String(artifact.storage_path));
    const buffer = await readFile(absolutePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType(String(artifact.file_type || "json")),
        "Content-Disposition": `attachment; filename="${artifact.file_name || path.basename(absolutePath)}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
