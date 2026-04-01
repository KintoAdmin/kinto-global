import { redirect } from 'next/navigation';

// Progress tracker has been merged into the unified Transformation Roadmap page
export default async function ProgressPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await (searchParams ?? Promise.resolve({}));
  const assessmentId = typeof params.assessmentId === 'string' ? params.assessmentId : undefined;
  const clientId = typeof params.clientId === 'string' ? params.clientId : undefined;
  const parts: string[] = [];
  if (clientId) parts.push(`clientId=${encodeURIComponent(clientId)}`);
  if (assessmentId) parts.push(`assessmentId=${encodeURIComponent(assessmentId)}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  redirect(`/transformation/roadmap${qs}`);
}
