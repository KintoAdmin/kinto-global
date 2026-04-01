// @ts-nocheck
export type SharedRouteState = {
  clientId?: string | null;
  assessmentId?: string | null;
  view?: string | null;
};

export function buildRoute(pathname: string, state: SharedRouteState = {}) {
  const params = new URLSearchParams();
  if (state.clientId) params.set('clientId', state.clientId);
  if (state.assessmentId) params.set('assessmentId', state.assessmentId);
  if (state.view) params.set('view', state.view);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
