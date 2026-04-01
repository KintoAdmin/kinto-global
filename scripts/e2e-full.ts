// @ts-nocheck
import {
  APP_BASE_URL,
  QA_SCENARIOS,
  check,
  summarize,
  verifyAssessment,
  waitForHealthyApp,
  writeArtifact,
  seedScenario,
} from './qa-v2-lib';

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function runScenario(scenario: any) {
  const results: any[] = [];
  const seed = await check(`e2e:${scenario.key}:seed`, async () => {
    const seeded = await seedScenario(scenario);
    return {
      ok: true,
      detail: `Seeded ${scenario.label}.`,
      data: seeded,
    };
  });
  results.push(seed);

  let seededRun = seed.data;
  if (seed.ok) {
    const verificationResults = await verifyAssessment(seededRun);
    results.push(...verificationResults);
  }

  return {
    scenario: scenario.key,
    label: scenario.label,
    seeded: seededRun || null,
    results,
    summary: summarize(results),
  };
}

async function main() {
  const selected = String(process.argv[2] || process.env.E2E_SCENARIO || 'realistic').trim().toLowerCase();
  const scenarios = selected === 'all'
    ? [...QA_SCENARIOS]
    : QA_SCENARIOS.filter((scenario) => scenario.key.toLowerCase() === selected);

  if (!scenarios.length) {
    throw new Error(`Unknown E2E_SCENARIO \"${selected}\". Use one of: ${QA_SCENARIOS.map((s) => s.key).join(', ')}, all`);
  }

  const startedAt = new Date().toISOString();
  const overallResults: any[] = [];
  const runs: any[] = [];

  overallResults.push(await check('e2e:health', async () => {
    const ready = await waitForHealthyApp();
    return {
      ok: true,
      status: ready.status,
      detail: `Health route responded after ${ready.waitedMs}ms at ${APP_BASE_URL}.`,
      data: ready.data,
    };
  }));

  if (!overallResults[0].ok) {
    const failedPayload = {
      appBaseUrl: APP_BASE_URL,
      selectedScenario: selected,
      startedAt,
      runAt: new Date().toISOString(),
      summary: summarize(overallResults),
      runs,
      results: overallResults,
    };
    writeArtifact('e2e-full-latest.json', failedPayload);
    writeArtifact(`e2e-full-${stamp()}.json`, failedPayload);
    process.exitCode = 1;
    return;
  }

  for (const scenario of scenarios) {
    const run = await runScenario(scenario);
    runs.push(run);
    overallResults.push(...run.results);
  }

  const payload = {
    appBaseUrl: APP_BASE_URL,
    selectedScenario: selected,
    startedAt,
    runAt: new Date().toISOString(),
    summary: summarize(overallResults),
    runs,
    results: overallResults,
  };

  writeArtifact('e2e-full-latest.json', payload);
  writeArtifact(`e2e-full-${stamp()}.json`, payload);

  console.log(`\nE2E SUMMARY: ${payload.summary.passed}/${payload.summary.total} passed, ${payload.summary.failed} failed.\n`);
  for (const run of runs) {
    console.log(`Scenario: ${run.label} -> ${run.summary.passed}/${run.summary.total} passed, ${run.summary.failed} failed.`);
  }
  console.log(`Artifact: qa-artifacts/e2e-full-latest.json\n`);

  if (payload.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
