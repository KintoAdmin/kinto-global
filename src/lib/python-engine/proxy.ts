// @ts-nocheck
import { NextResponse } from "next/server";

const PYTHON_TIMEOUT_MS = 2500;

type PythonHealthStatus = {
  configured: boolean;
  reachable: boolean;
  status?: unknown;
  error?: string;
};

function baseUrl() {
  const raw = process.env.PYTHON_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : '';
}

export function pythonEngineConfigured() {
  return Boolean(baseUrl());
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = PYTHON_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function getPythonHealthStatus(): Promise<PythonHealthStatus> {
  const base = baseUrl();
  if (!base) return { configured: false, reachable: false };
  try {
    const response = await fetchWithTimeout(`${base}/health`);
    const data = response.ok ? await response.json().catch(() => null) : null;
    return { configured: true, reachable: response.ok, status: data, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    return { configured: true, reachable: false, error: error instanceof Error ? error.message : 'fetch failed' };
  }
}

export async function proxyToPython(request: Request, path: string) {
  const base = baseUrl();
  if (!base) throw new Error('PYTHON_API_BASE_URL is not configured.');
  const incoming = new URL(request.url);
  const target = new URL(`${base}${path}`);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = { method: request.method, headers, cache: 'no-store' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.clone().text();
  }

  const response = await fetchWithTimeout(target.toString(), init);
  const content = await response.text();
  return new NextResponse(content, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
  });
}

function pythonRouteProxyEnabled() {
  return String(process.env.PYTHON_ROUTE_PROXY_ENABLED || '').trim().toLowerCase() === 'true';
}

export async function proxyToPythonIfAvailable(request: Request, path: string) {
  if (!pythonEngineConfigured()) return null;
  if (!pythonRouteProxyEnabled()) return null;
  const health = await getPythonHealthStatus();
  if (!health.reachable) return null;
  try {
    return await proxyToPython(request, path);
  } catch {
    return null;
  }
}
