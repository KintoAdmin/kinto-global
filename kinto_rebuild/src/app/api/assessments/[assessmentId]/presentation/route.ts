import fs from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getArtifact } from '@/lib/repositories/report-delivery';
import { buildAssessmentReport, buildStandaloneModuleReport, getPersistedReport } from '@/lib/services/report';
import { LEGACY_TO_INTEROP_MODULE, type LegacyModuleCode, type ModuleCode } from '@/lib/interoperability/enums';

function normalizeModuleCode(value?: string | null): ModuleCode | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw in LEGACY_TO_INTEROP_MODULE) return LEGACY_TO_INTEROP_MODULE[raw as LegacyModuleCode];
  return raw as ModuleCode;
}

function artifactByType(report: any, fileType: string) {
  return (report?.artifacts || []).find((artifact: any) => String(artifact.file_type || artifact.fileType || '').toLowerCase() === fileType);
}

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const moduleCode = normalizeModuleCode(request.nextUrl.searchParams.get('module'));

    let persisted = await getPersistedReport(assessmentId, moduleCode);
    if (!persisted || !artifactByType(persisted, 'pptx')) {
      await (moduleCode ? buildStandaloneModuleReport(assessmentId, moduleCode) : buildAssessmentReport(assessmentId));
      persisted = await getPersistedReport(assessmentId, moduleCode);
    }

    const pptxArtifact = artifactByType(persisted, 'pptx');
    if (!pptxArtifact?.artifact_id) {
      throw new Error('PPTX artifact was not generated.');
    }

    const artifact = await getArtifact(pptxArtifact.artifact_id);
    if (!artifact?.storage_path) {
      throw new Error('PPTX artifact storage path was not found.');
    }

    const buffer = await fs.readFile(artifact.storage_path);
    const fileName = artifact.file_name || `${assessmentId}${moduleCode ? `-${moduleCode}` : ''}.pptx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unexpected PPTX response.' },
      { status: 500 }
    );
  }
}
