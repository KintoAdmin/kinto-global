import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = ((searchParams ? await searchParams : {}) ?? {}) as SearchParams;

  const assessmentId =
    typeof params['assessmentId'] === 'string' ? params['assessmentId'] : undefined;

  const clientId =
    typeof params['clientId'] === 'string' ? params['clientId'] : undefined;

  const parts: string[] = [];
  if (clientId) parts.push(`clientId=${encodeURIComponent(clientId)}`);
  if (assessmentId) parts.push(`assessmentId=${encodeURIComponent(assessmentId)}`);

  const qs = parts.length ? `?${parts.join('&')}` : '';
  redirect(`/transformation/roadmap${qs}`);
}