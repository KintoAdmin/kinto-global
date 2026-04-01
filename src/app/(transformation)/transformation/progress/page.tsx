import { redirect } from 'next/navigation';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params: SearchParams = (await searchParams) ?? {};
  const assessmentId =
    typeof params.assessmentId === 'string' ? params.assessmentId : undefined;
  const clientId =
    typeof params.clientId === 'string' ? params.clientId : undefined;

  const parts: string[] = [];
  if (clientId) parts.push(`clientId=${encodeURIComponent(clientId)}`);
  if (assessmentId) parts.push(`assessmentId=${encodeURIComponent(assessmentId)}`);

  const qs = parts.length ? `?${parts.join('&')}` : '';
  redirect(`/transformation/roadmap${qs}`);
}