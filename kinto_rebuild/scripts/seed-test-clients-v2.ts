// @ts-nocheck
import {
  QA_SCENARIOS,
  check,
  seedScenario,
  summarize,
  waitForHealthyApp,
  writeArtifact,
} from './qa-v2-lib';

async function main() {
  const requested = String(process.argv[2] || process.env.SEED_SCENARIO || 'all').trim().toLowerCase();
  const selectedScenarios = requested === 'all'
    ? [...QA_SCENARIOS]
    : QA_SCENARIOS.filter((scenario) => scenario.key.toLowerCase() === requested);
  if (!selectedScenarios.length) {
    throw new Error(`Unknown seed scenario "${requested}". Use one of: ${QA_SCENARIOS.map((s) => s.key).join(', ')}, all`);
  }

  const startedAt = new Date().toISOString();
  const seeded = [] as any[];
  const results = [] as any[];

  const health = await check('preflight:health', async () => {
    const ready = await waitForHealthyApp();
    return { ok: true, status: ready.status, detail: `Health ready in ${ready.waitedMs}ms`, data: ready.data };
  });
  results.push(health);
  if (!health.ok) {
    const payload = { startedAt, runAt: new Date().toISOString(), summary: summarize(results), seeded, results };
    writeArtifact('qa-seeded-test-clients-v2-latest.json', payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  for (const scenario of selectedScenarios) {
    const result = await check(`seed:${scenario.key}`, async () => {
      const seededScenario = await seedScenario(scenario);
      seeded.push(seededScenario);
      const payload = {
        startedAt,
        runAt: new Date().toISOString(),
        summary: summarize([...results, { ok: true }]),
        seeded,
      };
      writeArtifact(`qa-seeded-${scenario.key}.json`, seededScenario);
      writeArtifact('qa-seeded-test-clients-v2-latest.json', payload);
      return {
        ok: true,
        detail: `Seeded ${scenario.label}.`,
        data: {
          clientId: seededScenario.clientId,
          assessmentId: seededScenario.assessmentId,
          modules: seededScenario.modules,
        },
      };
    });
    results.push(result);
  }

  const payload = {
    startedAt,
    runAt: new Date().toISOString(),
    summary: summarize(results),
    seeded,
    results,
  };

  writeArtifact('qa-seeded-test-clients-v2-latest.json', payload);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeArtifact(`qa-seeded-test-clients-v2-${stamp}.json`, payload);
  console.log(JSON.stringify(payload, null, 2));
  if (payload.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
