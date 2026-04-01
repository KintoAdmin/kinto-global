import libraryJson from '@/data/ai-readiness/library.json';

export const AI_READINESS_LIBRARY = {
  moduleId: 'MOD-AIR',
  moduleCode: 'AIR',
  moduleName: 'AI Readiness',
  domains: libraryJson.domains,
  questions: libraryJson.questions,
  findings: libraryJson.findings,
  recommendations: libraryJson.recommendations,
  actions: libraryJson.actions
};
