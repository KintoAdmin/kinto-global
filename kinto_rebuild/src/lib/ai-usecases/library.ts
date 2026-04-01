import libraryJson from '@/data/ai-usecases/library.json';

export const AI_USECASE_LIBRARY = {
  moduleId: 'MOD-AIUC',
  moduleCode: 'AIUC',
  moduleName: 'AI Use Case Prioritisation',
  domains: libraryJson.domains,
  questions: libraryJson.questions,
  findings: [],
  recommendations: [],
  actions: [],
  usecases: libraryJson.usecases,
  factors: libraryJson.factors
};
