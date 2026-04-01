// @ts-nocheck
import { NextResponse } from "next/server";
import { getPythonHealthStatus } from "@/lib/python-engine/proxy";

export async function GET() {
  const pythonEngine = await getPythonHealthStatus();
  return NextResponse.json({
    ok: true,
    service: 'kinto-frontend',
    pythonEngine,
    runtimeMode: pythonEngine.reachable ? 'python-engine' : 'next-local-fallback'
  });
}
