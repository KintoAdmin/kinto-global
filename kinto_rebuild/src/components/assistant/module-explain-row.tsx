'use client';
import { ExplainButton } from './explain-button';

interface Props {
  moduleName: string;
  modulePct: number;
  maturityBand: string;
  topFindings?: string;
}

export function ModuleExplainRow({ moduleName, modulePct, maturityBand, topFindings }: Props) {
  return (
    <ExplainButton
      context={`Explain the ${moduleName} score of ${modulePct.toFixed(0)}% (${maturityBand}). ${topFindings ? 'Key findings: ' + topFindings : ''}`}
      label="Explain"
      compact
    />
  );
}
