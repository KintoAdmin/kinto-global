// @ts-nocheck
export type SearchParamInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

export type PageState = {
  clientId?: string;
  assessmentId?: string;
  view?: string;
};

export async function resolvePageState(searchParams?: SearchParamInput): Promise<PageState> {
  const params = (await searchParams) || {};
  const get = (key: string) => {
    const value = params[key];
    return typeof value === 'string' ? value : undefined;
  };

  return {
    clientId: get('clientId'),
    assessmentId: get('assessmentId'),
    view: get('view')
  };
}
