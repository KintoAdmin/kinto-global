import libraryJson from '@/data/data-foundation/library.json';

export const DATA_FOUNDATION_LIBRARY = {
  moduleId: 'MOD-DATA',
  moduleCode: 'DATA',
  moduleName: 'Data Foundation',
  domains: libraryJson.domains,
  questions: libraryJson.questions,
  findings: libraryJson.findings,
  recommendations: libraryJson.recommendations,
  actions: libraryJson.actions
};
