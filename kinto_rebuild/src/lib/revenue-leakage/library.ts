import libraryJson from '@/data/revenue-leakage/library.json';

export const LEAKAGE_LIBRARY = {
  moduleId: 'MOD-LEAK',
  moduleCode: 'LEAK',
  moduleName: 'Revenue Leakage',
  domains: libraryJson.domains,
  questions: libraryJson.questions,
  findings: libraryJson.findings,
  recommendations: libraryJson.recommendations,
  actions: libraryJson.actions
};
