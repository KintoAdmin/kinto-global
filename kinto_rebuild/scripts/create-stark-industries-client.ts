// @ts-nocheck
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { seedScenarioDirect } from './seed-direct-lib';

function stamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function main() {
  const unique = stamp();
  const clientName = `Stark Industries - Full System Demo - ${unique}`;
  const assessmentName = `Stark Industries Full System Review - ${unique}`;

  const scenario = {
    key: 'stark-industries-one-off',
    label: 'Stark Industries Full System Demo',
    clientName,
    assessmentName,
    industry: 'Industrial Technology / Advanced Engineering',
    businessModel: 'B2B Services + Projects + Recurring Support',
    revenueModel: 'Mixed recurring, project, and managed services',
    companySize: 'SME / Mid-Market',
    region: 'South Africa',
    notes: 'One-off fully populated review client created for mapping, reporting, and UI inspection.',
    benchmarkProfile: 'Professional Services SME',
    questionCycles: {
      OPS: [3, 3, 4, 2, 4, 3],
      DATA: [3, 2, 3, 3, 2, 3],
      AIR: [3, 2, 3, 3, 2, 3],
      AIUC: [3, 3, 4, 3, 2, 3],
    },
    metricProfile: {
      genericFactor: 0.82,
      pctFactor: 0.82,
      timeFactor: 1.35,
      countFactor: 0.84,
      currencyFactor: 0.88,
      leakageActualFactor: 0.88,
      leakageSupportFactor: 0.91,
      leakageDriverFactor: 0.97,
      trend: 'Mixed',
      rag: 'Amber',
    },
  };

  console.log(`[START] Creating fully populated client: ${clientName}`);
  const result = await seedScenarioDirect(scenario, { generateOutputs: true });

  console.log('\n=== STARK INDUSTRIES CLIENT CREATED ===');
  console.log(`Client Name: ${clientName}`);
  console.log(`Assessment Name: ${assessmentName}`);
  console.log(`Client ID: ${result.clientId}`);
  console.log(`Assessment ID: ${result.assessmentId}`);
  console.log('');
  console.log('Module summary:');
  console.log(JSON.stringify(result.modules, null, 2));
  console.log('');
  console.log('Roadmap summary:');
  console.log(JSON.stringify(result.roadmap, null, 2));
  console.log('');
  console.log('Open this assessment in the app using the assessment ID above.');
}

main().catch((error) => {
  console.error('\n[FAIL] Stark Industries client creation failed.');
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
